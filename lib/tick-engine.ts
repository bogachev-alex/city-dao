import type { GameEvent, PrismaClient } from '@/lib/generated/prisma'

export const GAME_STATE_ID = 'singleton'

/** In-game calendar day G as UTC midnight anchor from simulation start. */
export function gameDayDateUtc(startDate: Date, gameDay: number): Date {
  const d = new Date(startDate)
  d.setUTCDate(d.getUTCDate() + gameDay)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function addDaysUtc(base: Date, days: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function extractSuggestionId(description: string | null): string | null {
  if (!description) return null
  const match = description.match(/\[suggestion:([^\]]+)\]/)
  return match?.[1] ?? null
}

const TREASURY_INCOME_PER_TICK = BigInt(1_000_000) // tenge per district per game day

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>

async function logEvent(
  tx: Tx,
  gameDay: number,
  type: string,
  extra?: { entityId?: string; actorId?: string; actorRole?: string; data?: object }
): Promise<GameEvent> {
  return tx.gameEvent.create({
    data: {
      gameDay,
      type,
      entityId: extra?.entityId,
      actorId: extra?.actorId,
      actorRole: extra?.actorRole,
      ...(extra?.data !== undefined ? { data: extra.data } : {}),
    },
  })
}

async function isLowSatisfactionStreak(
  tx: Tx,
  district: string,
  gameDay: number,
  days: number,
  thresholdPct: number
): Promise<boolean> {
  if (gameDay < days - 1) return false
  for (let d = gameDay - (days - 1); d <= gameDay; d++) {
    const agg = await tx.satisfactionVote.aggregate({
      where: { district, gameDay: d },
      _avg: { score: true },
    })
    if (agg._avg.score == null) return false
    const pct = (Number(agg._avg.score) / 5) * 100
    if (pct >= thresholdPct) return false
  }
  return true
}

async function finalizeJuryIfPossible(tx: Tx, sessionId: string, gameDay: number) {
  const allVotes = await tx.juryVote.findMany({ where: { sessionId } })
  const revealed = allVotes.filter((v) => v.revealedVote !== null)
  if (revealed.length === 0) {
    await tx.jurySession.update({
      where: { id: sessionId },
      data: { status: 'ESCALATED' },
    })
    await logEvent(tx, gameDay, 'JURY_ESCALATED_NO_VOTES', { entityId: sessionId })
    return
  }
  let weightedAccept = 0
  let weightedReject = 0
  for (const v of revealed) {
    if (v.revealedVote === 'ACCEPT') weightedAccept += v.weight
    else weightedReject += v.weight
  }
  const result = weightedAccept >= weightedReject ? 'ACCEPT' : 'REJECT'
  const status = weightedAccept === 2 && weightedReject === 2 ? 'ESCALATED' : 'FINALIZED'
  await tx.jurySession.update({
    where: { id: sessionId },
    data: { status, result, weightedAccept, weightedReject },
  })
  await logEvent(tx, gameDay, 'JURY_FINALIZED', {
    entityId: sessionId,
    data: { result, status },
  })
}

async function recalcContractorMetrics(tx: Tx, contractorId: string) {
  const contracts = await tx.contract.findMany({
    where: { contractorId },
    include: { milestones: true },
  })
  let accepted = 0
  let decided = 0
  for (const c of contracts) {
    for (const m of c.milestones) {
      if (m.status === 'ACCEPTED' || m.status === 'REJECTED') {
        decided++
        if (m.status === 'ACCEPTED') accepted++
      }
    }
  }
  const acceptanceRate = decided > 0 ? accepted / decided : 1
  await tx.contractor.update({
    where: { id: contractorId },
    data: {
      acceptanceRate,
      onTimeRate: acceptanceRate,
    },
  })
}

/**
 * Runs one game day: increments clock and applies deterministic transitions.
 */
export async function runGameTick(prisma: PrismaClient): Promise<{
  gameDay: number
  events: GameEvent[]
  paused: boolean
}> {
  const events: GameEvent[] = []

  return prisma.$transaction(async (tx) => {
    let state = await tx.gameState.findUnique({ where: { id: GAME_STATE_ID } })
    if (!state) {
      state = await tx.gameState.create({
        data: { id: GAME_STATE_ID, gameDay: 0, startDate: new Date(), isPaused: false },
      })
    }
    if (state.isPaused) {
      return { gameDay: state.gameDay, events: [], paused: true }
    }

    const nextDay = state.gameDay + 1
    await tx.gameState.update({
      where: { id: GAME_STATE_ID },
      data: { gameDay: nextDay },
    })

    const gameToday = gameDayDateUtc(state.startDate, nextDay)

    // ── Milestones overdue + penalties ─────────────────────────────────
    const milestones = await tx.milestone.findMany({
      where: { status: { in: ['PENDING', 'SUBMITTED'] } },
      include: { contract: true },
    })
    const newlyOverdueIds = new Set<string>()

    for (const m of milestones) {
      const due = addDaysUtc(m.contract.startDate, m.deadlineDays)
      if (due.getTime() < gameToday.getTime()) {
        await tx.milestone.update({
          where: { id: m.id },
          data: { status: 'OVERDUE' },
        })
        const pct = (m.contract.totalAmount * BigInt(1)) / BigInt(100)
        await tx.penalty.create({
          data: {
            contractId: m.contract.id,
            type: 'TIME_OVERDUE',
            amountTenge: pct,
            daysOverdue: 1,
            triggeredBy: 'system:tick',
          },
        })
        await tx.contract.update({
          where: { id: m.contract.id },
          data: { penaltyAmount: { increment: pct } },
        })
        newlyOverdueIds.add(m.id)
        events.push(
          await logEvent(tx, nextDay, 'MILESTONE_OVERDUE', {
            entityId: m.id,
            data: { contractId: m.contract.id },
          })
        )
      }
    }

    // ── Already OVERDUE: recurring 1% per game day (skip same tick) ───
    const overdueMs = await tx.milestone.findMany({
      where: { status: 'OVERDUE' },
      include: { contract: true },
    })
    for (const m of overdueMs) {
      if (newlyOverdueIds.has(m.id)) continue
      const pct = (m.contract.totalAmount * BigInt(1)) / BigInt(100)
      await tx.penalty.create({
        data: {
          contractId: m.contract.id,
          type: 'TIME_OVERDUE',
          amountTenge: pct,
          daysOverdue: 1,
          triggeredBy: 'system:tick-recurring',
        },
      })
      await tx.contract.update({
        where: { id: m.contract.id },
        data: { penaltyAmount: { increment: pct } },
      })
      events.push(
        await logEvent(tx, nextDay, 'PENALTY_APPLIED', {
          entityId: m.contract.id,
          data: { milestoneId: m.id, amount: pct.toString() },
        })
      )
    }

    // ── Jury phase advances (game-day based) ───────────────────────────
    const sessions = await tx.jurySession.findMany({
      where: { status: { in: ['COMMIT_PHASE', 'REVEAL_PHASE'] } },
    })
    for (const s of sessions) {
      if (s.status === 'COMMIT_PHASE') {
        let start = s.commitPhaseStartedGameDay
        if (start === null || start === undefined) {
          start = nextDay
          await tx.jurySession.update({
            where: { id: s.id },
            data: { commitPhaseStartedGameDay: nextDay },
          })
        }
        if (nextDay >= (start as number) + 2) {
          await tx.jurySession.update({
            where: { id: s.id },
            data: {
              status: 'REVEAL_PHASE',
              revealPhaseStartedGameDay: nextDay,
            },
          })
          events.push(
            await logEvent(tx, nextDay, 'JURY_REVEAL_PHASE', { entityId: s.id })
          )
        }
      } else if (s.status === 'REVEAL_PHASE') {
        let rStart = s.revealPhaseStartedGameDay
        if (rStart === null || rStart === undefined) {
          rStart = nextDay
          await tx.jurySession.update({
            where: { id: s.id },
            data: { revealPhaseStartedGameDay: nextDay },
          })
        }
        if (nextDay >= (rStart as number) + 1) {
          await finalizeJuryIfPossible(tx, s.id, nextDay)
        }
      }
    }

    // ── Spending proposals: close voting ───────────────────────────────
    const proposals = await tx.spendingProposal.findMany({
      where: { status: 'VOTING', votingEnds: { not: null } },
      include: { treasury: true },
    })
    for (const p of proposals) {
      if (!p.votingEnds) continue
      if (p.votingEnds.getTime() <= gameToday.getTime()) {
        const approved = p.votesFor > p.votesAgainst && p.quorumMet
        await tx.spendingProposal.update({
          where: { id: p.id },
          data: { status: approved ? 'APPROVED' : 'REJECTED' },
        })
        events.push(
          await logEvent(tx, nextDay, 'PROPOSAL_CLOSED', {
            entityId: p.id,
            data: { approved },
          })
        )

        const suggestionId = extractSuggestionId(p.description)
        if (approved && p.treasury.balance >= p.amount) {
          await tx.districtTreasury.update({
            where: { id: p.treasuryId },
            data: { balance: { decrement: p.amount } },
          })
          const deadline = addDaysUtc(gameToday, 30)
          const contract = await tx.contract.create({
            data: {
              title: p.title,
              description: `Funded from proposal ${p.id}`,
              district: p.treasury.district,
              lat: 43.238949,
              lng: 76.889709,
              contractorId: null,
              totalAmount: p.amount,
              escrowAmount: p.amount / BigInt(5),
              deadline,
              category: p.category ?? 'CITIZEN_SUGGESTION',
            },
          })
          if (suggestionId) {
            await tx.citizenSuggestion.update({
              where: { id: suggestionId },
              data: { status: 'FUNDED' },
            })
          }
          events.push(
            await logEvent(tx, nextDay, 'SUGGESTION_FUNDED_CONTRACT_CREATED', {
              entityId: contract.id,
              data: { proposalId: p.id, suggestionId },
            })
          )
        } else if (!approved && suggestionId) {
          await tx.citizenSuggestion.update({
            where: { id: suggestionId },
            data: { status: 'REJECTED' },
          })
        }
      }
    }

    // ── Treasury income (satisfaction modifier) ────────────────────────
    const treasuries = await tx.districtTreasury.findMany()
    for (const t of treasuries) {
      const penalized = await isLowSatisfactionStreak(tx, t.district, nextDay, 5, 40)
      const income = penalized ? TREASURY_INCOME_PER_TICK / BigInt(2) : TREASURY_INCOME_PER_TICK
      await tx.districtTreasury.update({
        where: { id: t.id },
        data: { balance: { increment: income } },
      })
      events.push(
        await logEvent(tx, nextDay, 'TREASURY_INCOME', {
          entityId: t.id,
          data: { district: t.district, amount: income.toString(), lowSatisfactionPenalty: penalized },
        })
      )
    }

    // ── Crowdfunding deadlines ─────────────────────────────────────────
    const campaigns = await tx.crowdfundingCampaign.findMany({
      where: { status: 'ACTIVE' },
    })
    for (const c of campaigns) {
      if (c.deadline.getTime() < gameToday.getTime()) {
        await tx.crowdfundingCampaign.update({
          where: { id: c.id },
          data: { status: 'EXPIRED' },
        })
        events.push(
          await logEvent(tx, nextDay, 'CROWDFUNDING_EXPIRED', { entityId: c.id })
        )
      }
    }

    // ── Bid rounds: auto-close after closesDay ─────────────────────────
    const openRounds = await tx.bidRound.findMany({ where: { status: 'OPEN' } })
    for (const br of openRounds) {
      if (nextDay > br.closesDay) {
        await tx.bidRound.update({
          where: { id: br.id },
          data: { status: 'CLOSED' },
        })
        events.push(
          await logEvent(tx, nextDay, 'BID_ROUND_CLOSED', {
            entityId: br.id,
            data: { contractId: br.contractId },
          })
        )
      }
    }

    // ── Contractor metrics ─────────────────────────────────────────────
    const contractorIds = await tx.contractor.findMany({ select: { id: true } })
    for (const { id } of contractorIds) {
      await recalcContractorMetrics(tx, id)
    }

    events.push(
      await logEvent(tx, nextDay, 'TICK_COMPLETE', {
        data: { previousDay: state.gameDay, nextDay },
      })
    )

    return { gameDay: nextDay, events, paused: false }
  })
}
