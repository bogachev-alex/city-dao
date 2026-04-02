import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEMO_TRANSACTIONS, type TxType } from '@/lib/demoTransactions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/transactions — real transactions from DB (crowdfunding, penalties, treasury votes) + optional demo fill
 * Query: district (filter by campaign/contract/treasury district), limit (1–100), demo=0 to disable demo padding
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const district = searchParams.get('district')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100)
  const mergeDemo = searchParams.get('demo') !== '0'
  const takeEach = Math.min(limit * 3, 150)

  const isDistrictPage = !!district

  const contribWhere = isDistrictPage
    ? { campaign: { district } }
    : { txSignature: { not: null } }

  const penaltyWhere = isDistrictPage
    ? { contract: { district } }
    : { txSignature: { not: null } }

  const voteWhere = isDistrictPage
    ? { proposal: { treasury: { district } } }
    : { txSignature: { not: null } }

  const [contributions, penalties, votes] = await Promise.all([
    prisma.campaignContribution.findMany({
      where: contribWhere,
      include: { campaign: { select: { id: true, title: true, district: true } } },
      orderBy: { createdAt: 'desc' },
      take: takeEach,
    }),
    prisma.penalty.findMany({
      where: penaltyWhere,
      include: { contract: { select: { id: true, title: true, district: true } } },
      orderBy: { createdAt: 'desc' },
      take: takeEach,
    }),
    prisma.proposalVote.findMany({
      where: voteWhere,
      include: {
        citizen: { select: { walletAddress: true } },
        proposal: { select: { id: true, title: true, treasury: { select: { district: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: takeEach,
    }),
  ])

  type Row = {
    signature: string
    type: TxType
    description: string
    timestamp: Date
    amount?: number
    contractId?: string
  }

  const rows: Row[] = []

  for (const c of contributions) {
    const sig = c.txSignature || `cf-${c.id}`
    const amount = Number(c.amount)
    rows.push({
      signature: sig,
      type: 'cf_contribute',
      description: `Краудфандинг «${c.campaign.title}»${c.anonymous ? ' (анонимно)' : ''}: ${new Intl.NumberFormat('ru-KZ').format(amount)} ₸`,
      timestamp: c.createdAt,
      amount,
    })
  }

  const penaltyTypeRu: Record<string, string> = {
    TIME_OVERDUE: 'просрочка',
    QUALITY_REJECTED: 'качество',
    GHOST_SITE: 'брошенный объект',
  }

  for (const p of penalties) {
    const sig = p.txSignature || `penalty-${p.id}`
    const amount = Number(p.amountTenge)
    const kind = penaltyTypeRu[p.type] || p.type
    rows.push({
      signature: sig,
      type: 'trigger_penalty',
      description: `Штраф (${kind}): ${p.contract.title} — ${new Intl.NumberFormat('ru-KZ').format(amount)} ₸ → казна района`,
      timestamp: p.createdAt,
      amount,
      contractId: p.contractId,
    })
  }

  for (const v of votes) {
    const sig = (v as any).txSignature || `vote-${v.id}`
    rows.push({
      signature: sig,
      type: 'treasury_vote',
      description: `Голосование: «${v.proposal.title}» — ${v.inFavor ? 'За' : 'Против'}`,
      timestamp: v.createdAt,
    })
  }

  rows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  let merged = rows.slice(0, limit)
  let demoAppended = false
  const seen = new Set(merged.map((x) => x.signature))

  if (mergeDemo && merged.length < limit) {
    for (const tx of DEMO_TRANSACTIONS) {
      if (merged.length >= limit) break
      if (seen.has(tx.signature)) continue
      if (district && tx.district && tx.district !== district) continue
      merged.push({
        signature: tx.signature,
        type: tx.type,
        description: tx.description,
        timestamp: tx.timestamp,
        amount: tx.amount,
        contractId: tx.contractId,
      })
      seen.add(tx.signature)
      demoAppended = true
    }
  }

  return NextResponse.json({
    items: merged.map((x) => ({
      signature: x.signature,
      type: x.type,
      description: x.description,
      timestamp: x.timestamp.toISOString(),
      amount: x.amount,
      contractId: x.contractId,
    })),
    demoAppended,
  })
}
