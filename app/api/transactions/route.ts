import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEMO_TRANSACTIONS, type TxType } from '@/lib/demoTransactions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/transactions — on-chain tx signatures from DB (crowdfunding, penalties) + optional demo fill
 * Query: district (filter by campaign/contract district), limit (1–100), demo=0 to disable demo padding
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const district = searchParams.get('district')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100)
  const mergeDemo = searchParams.get('demo') !== '0'
  const takeEach = Math.min(limit * 3, 150)

  const contribWhere = {
    txSignature: { not: null },
    ...(district ? { campaign: { district } } : {}),
  }

  const penaltyWhere = {
    txSignature: { not: null },
    ...(district ? { contract: { district } } : {}),
  }

  const [contributions, penalties] = await Promise.all([
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
    if (!c.txSignature) continue
    const amount = Number(c.amount)
    rows.push({
      signature: c.txSignature,
      type: 'cf_contribute',
      description: `Краудфандинг «${c.campaign.title}»${c.anonymous ? ' (анонимно)' : ''}: ${new Intl.NumberFormat('ru-KZ').format(amount)} ₸`,
      timestamp: c.createdAt,
      amount,
    })
  }

  const penaltyTypeRu: Record<string, string> = {
    TIME_OVERDUE: 'просрочка',
    QUALITY_REJECTED: 'качество',
    GHOST_SITE: 'несанкционированный съём',
  }

  for (const p of penalties) {
    if (!p.txSignature) continue
    const amount = Number(p.amountTenge)
    const kind = penaltyTypeRu[p.type] || p.type
    rows.push({
      signature: p.txSignature,
      type: 'trigger_penalty',
      description: `Штраф (${kind}): ${p.contract.title}`,
      timestamp: p.createdAt,
      amount,
      contractId: p.contractId,
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
