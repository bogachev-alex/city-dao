/**
 * Closed-loop simulation runner for the Amanat Protocol game loop.
 *
 * Requires a running Next.js dev server (default baseUrl http://127.0.0.1:3000).
 *
 * Run:
 *   npm run sim:runner
 *   SIM_BASE_URL=http://127.0.0.1:3000 SIM_DAYS=30 npm run sim:runner
 *   SIM_CONFIG=scripts/agent-profiles.json npm run sim:runner
 */
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

import fs from 'fs'
import path from 'path'

type Role = 'CITIZEN' | 'CONTRACTOR' | 'AKIMAT'

type AgentConfig = {
  role: Role
  id: string
  name?: string
  district?: string
}

type RunnerConfig = {
  baseUrl?: string
  days?: number
  agents: AgentConfig[]
}

async function resolveAgents(baseUrl: string, agents: AgentConfig[]): Promise<AgentConfig[]> {
  const out = [...agents]
  const needCitizen = out.some((a) => a.role === 'CITIZEN' && a.id.startsWith('demo-citizen-'))
  const needContractor = out.some((a) => a.role === 'CONTRACTOR' && a.id.startsWith('demo-contractor-'))

  let citizens: any[] = []
  let contractors: any[] = []
  if (needCitizen) {
    citizens = await apiJson(baseUrl, '/api/citizens')
  }
  if (needContractor) {
    contractors = await apiJson(baseUrl, '/api/contractors')
  }

  let ci = 0
  let co = 0
  for (let i = 0; i < out.length; i++) {
    const a = out[i]
    if (a.role === 'CITIZEN' && a.id.startsWith('demo-citizen-') && citizens[ci]?.id) {
      out[i] = { ...a, id: citizens[ci].id, district: citizens[ci].district }
      ci++
    }
    if (a.role === 'CONTRACTOR' && a.id.startsWith('demo-contractor-') && contractors[co]?.id) {
      out[i] = { ...a, id: contractors[co].id }
      co++
    }
  }

  return out
}

function toBaseUrl(raw: string) {
  const u = new URL(raw)
  if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') {
    throw new Error(`Refusing non-local baseUrl host: ${u.hostname}`)
  }
  return u.toString().replace(/\/$/, '')
}

function pickAction(payload: any): { action: string; params: Record<string, unknown> } | null {
  const actions = Array.isArray(payload?.availableActions) ? payload.availableActions : []
  if (actions.length === 0) return null

  const priority = [
    'vote_jury',
    'rate_satisfaction',
    'vote_proposal',
    'open_bid_round',
    'select_bid_winner',
    'bid_on_contract',
    'upvote_suggestion',
    'create_suggestion',
    'contribute_crowdfunding',
    'submit_work_log',
    'claim_milestone',
    'report_blocker',
  ]

  const byName = new Map<string, any[]>()
  for (const a of actions) {
    if (typeof a?.action !== 'string') continue
    const arr = byName.get(a.action) ?? []
    arr.push(a)
    byName.set(a.action, arr)
  }

  for (const p of priority) {
    const bucket = byName.get(p)
    if (!bucket || bucket.length === 0) continue
    const chosen = bucket[0]

    if (p === 'vote_jury') {
      return { action: 'vote_jury', params: { sessionId: chosen.sessionId, vote: 'ACCEPT' } }
    }
    if (p === 'rate_satisfaction') {
      return { action: 'rate_satisfaction', params: { score: 4 } }
    }
    if (p === 'vote_proposal') {
      return { action: 'vote_proposal', params: { proposalId: chosen.proposalId, inFavor: true } }
    }
    if (p === 'open_bid_round') {
      return { action: 'open_bid_round', params: { contractId: chosen.contractId } }
    }
    if (p === 'select_bid_winner') {
      return { action: 'select_bid_winner', params: { bidRoundId: chosen.bidRoundId } }
    }
    if (p === 'bid_on_contract') {
      // Naive: bid 90% of budget if present; otherwise 1_000_000.
      const budget = chosen.budget ? BigInt(chosen.budget) : BigInt(1_000_000)
      const amount = (budget * BigInt(90)) / BigInt(100)
      return {
        action: 'bid_on_contract',
        params: {
          bidRoundId: chosen.bidRoundId,
          amount: amount.toString(),
          daysToComplete: 7,
          qualityPledge: 'Deliver on time with verified logs.',
        },
      }
    }
    if (p === 'upvote_suggestion') {
      return { action: 'upvote_suggestion', params: { suggestionId: chosen.suggestionId } }
    }
    if (p === 'create_suggestion') {
      // Needs title/problemDesc/district; use profile context when possible.
      const district = payload?.profile?.district || payload?.district || chosen.district || 'Алмалинский'
      return {
        action: 'create_suggestion',
        params: {
          title: `Fix streetlighting (day ${payload?.gameDay ?? 0})`,
          problemDesc: 'Street lights are frequently off at night; safety risk for pedestrians.',
          district,
          lat: 43.25,
          lng: 76.91,
          urgency: 'MEDIUM',
          budgetMin: '1000000',
          budgetMax: '3000000',
        },
      }
    }
    if (p === 'contribute_crowdfunding') {
      return {
        action: 'contribute_crowdfunding',
        params: { campaignId: chosen.campaignId, amount: '500', anonymous: true },
      }
    }
    if (p === 'submit_work_log') {
      return { action: 'submit_work_log', params: { contractId: chosen.contractId, title: 'Daily update' } }
    }
    if (p === 'claim_milestone') {
      return { action: 'claim_milestone', params: { contractId: chosen.contractId, milestoneId: chosen.milestoneId } }
    }
    if (p === 'report_blocker') {
      return { action: 'report_blocker', params: { contractId: chosen.contractId, description: 'Waiting on materials' } }
    }
  }

  return null
}

async function apiJson(baseUrl: string, p: string, init?: RequestInit) {
  const url = `${baseUrl}${p.startsWith('/') ? p : `/${p}`}`
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const text = await res.text()
  let json: any
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const msg = json?.error || `HTTP ${res.status}`
    throw new Error(`${init?.method || 'GET'} ${p} failed: ${msg}`)
  }
  return json
}

async function main() {
  const configPath = process.env.SIM_CONFIG
    ? path.resolve(process.cwd(), process.env.SIM_CONFIG)
    : path.resolve(process.cwd(), 'scripts/agent-profiles.json')

  const parsed: RunnerConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

  const baseUrl = toBaseUrl(process.env.SIM_BASE_URL || parsed.baseUrl || 'http://127.0.0.1:3000')
  const days = Number(process.env.SIM_DAYS || parsed.days || 10)
  if (!Number.isFinite(days) || days < 1) throw new Error('SIM_DAYS must be >= 1')
  const agents = await resolveAgents(baseUrl, parsed.agents)

  console.log(`Base URL: ${baseUrl}`)
  console.log(`Days: ${days}`)
  console.log(`Agents: ${agents.length}`)

  for (let i = 0; i < days; i++) {
    const tick = await apiJson(baseUrl, '/api/game/tick', { method: 'POST' })
    const gameDay = tick.gameDay
    console.log(`\n=== Day ${gameDay} ===`)
    if (Array.isArray(tick.events)) {
      const types = tick.events.map((e: any) => e.type).slice(0, 8)
      if (types.length) console.log(`Events: ${types.join(', ')}`)
    }

    for (const agent of agents) {
      const observe = await apiJson(
        baseUrl,
        `/api/agent/observe?role=${encodeURIComponent(agent.role)}&id=${encodeURIComponent(agent.id)}`
      )
      const chosen = pickAction(observe)
      if (!chosen) continue
      try {
        const out = await apiJson(baseUrl, '/api/agent/action', {
          method: 'POST',
          body: JSON.stringify({
            role: agent.role,
            agentId: agent.id,
            action: chosen.action,
            params: chosen.params,
          }),
        })
        console.log(`[${agent.role}:${agent.id}] ${chosen.action} -> ok`)
        if (out?.result?.proposalId) {
          console.log(`  proposalId=${out.result.proposalId}`)
        }
        if (out?.result?.bidRoundId) {
          console.log(`  bidRoundId=${out.result.bidRoundId}`)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log(`[${agent.role}:${agent.id}] ${chosen.action} -> error: ${msg}`)
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})

