import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PENALTY_RATES = {
  TIME_OVERDUE: { rate: 0.01, label: '1% per day' },
  QUALITY_REJECTED: { rate: 0.10, label: '10% per rejection' },
  GHOST_SITE: { rate: 0.05, label: '5% per ghost-site report' },
} as const

const MAX_PENALTY_PCT = 0.30

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const { type, daysOverdue, rejectionCount, ghostCount, triggeredBy, txSignature } = body

  if (!type || !['TIME_OVERDUE', 'QUALITY_REJECTED', 'GHOST_SITE'].includes(type)) {
    return NextResponse.json({ error: 'Invalid penalty type' }, { status: 400 })
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { penalties: true },
  })

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  const totalAmount = Number(contract.totalAmount)
  const maxPenalty = Math.floor(totalAmount * MAX_PENALTY_PCT)

  const existingPenaltyTotal = contract.penalties.reduce(
    (sum, p) => sum + Number(p.amountTenge), 0
  )

  const rate = PENALTY_RATES[type as keyof typeof PENALTY_RATES].rate
  let rawPenalty: number

  switch (type) {
    case 'TIME_OVERDUE':
      if (!daysOverdue || daysOverdue <= 0) {
        return NextResponse.json({ error: 'daysOverdue must be > 0' }, { status: 400 })
      }
      rawPenalty = totalAmount * rate * daysOverdue
      break
    case 'QUALITY_REJECTED':
      if (!rejectionCount || rejectionCount <= 0) {
        return NextResponse.json({ error: 'rejectionCount must be > 0' }, { status: 400 })
      }
      rawPenalty = totalAmount * rate * rejectionCount
      break
    case 'GHOST_SITE':
      if (!ghostCount || ghostCount <= 0) {
        return NextResponse.json({ error: 'ghostCount must be > 0' }, { status: 400 })
      }
      rawPenalty = totalAmount * rate * ghostCount
      break
    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  }

  const cappedTotal = Math.min(existingPenaltyTotal + rawPenalty, maxPenalty)
  const actualPenalty = cappedTotal - existingPenaltyTotal

  if (actualPenalty <= 0) {
    return NextResponse.json(
      { error: 'No penalty due — cap already reached (30%)', maxPenalty, existingPenaltyTotal },
      { status: 409 }
    )
  }

  const treasury = await prisma.districtTreasury.findUnique({
    where: { district: contract.district },
  })

  if (!treasury) {
    return NextResponse.json({ error: 'District treasury not found' }, { status: 404 })
  }

  const [penalty, , updatedContract] = await prisma.$transaction([
    prisma.penalty.create({
      data: {
        contractId: contract.id,
        type,
        amountTenge: BigInt(Math.floor(actualPenalty)),
        daysOverdue: type === 'TIME_OVERDUE' ? daysOverdue : null,
        triggeredBy: triggeredBy || null,
        txSignature: txSignature || null,
      },
    }),
    prisma.districtTreasury.update({
      where: { id: treasury.id },
      data: { balance: { increment: BigInt(Math.floor(actualPenalty)) } },
    }),
    prisma.contract.update({
      where: { id: contract.id },
      data: {
        penaltyAmount: { increment: BigInt(Math.floor(actualPenalty)) },
        ...(cappedTotal >= maxPenalty ? { status: 'PENALIZED' } : {}),
      },
    }),
  ])

  return NextResponse.json({
    penalty: {
      ...penalty,
      amountTenge: penalty.amountTenge.toString(),
    },
    treasuryBalance: (await prisma.districtTreasury.findUnique({ where: { id: treasury.id } }))!.balance.toString(),
    contractPenaltyTotal: updatedContract.penaltyAmount.toString(),
    capped: cappedTotal >= maxPenalty,
  }, { status: 201 })
}
