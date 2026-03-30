import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** GET /api/akimat/overview — сводка для кабинета акимата: контракты, казны, граждане, последние контракты */
export async function GET() {
  const [
    totalContracts,
    activeContracts,
    disputedContracts,
    penalizedContracts,
    citizensCount,
    treasuries,
    recentContracts,
  ] = await Promise.all([
    prisma.contract.count(),
    prisma.contract.count({ where: { status: 'ACTIVE' } }),
    prisma.contract.count({ where: { status: 'DISPUTED' } }),
    prisma.contract.count({ where: { status: 'PENALIZED' } }),
    prisma.citizen.count(),
    prisma.districtTreasury.findMany({
      include: {
        proposals: {
          where: { status: 'VOTING' },
          select: { id: true, title: true, amount: true },
        },
      },
      orderBy: { district: 'asc' },
    }),
    prisma.contract.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        contractor: { select: { name: true } },
      },
    }),
  ])

  let totalBalance = BigInt(0)
  for (const t of treasuries) {
    totalBalance += t.balance
  }

  const votingProposalsTotal = treasuries.reduce((s, t) => s + t.proposals.length, 0)

  const treasuryRows = treasuries.map((t) => ({
    district: t.district,
    balance: t.balance.toString(),
    votingCount: t.proposals.length,
  }))

  return NextResponse.json({
    totalContracts,
    activeContracts,
    disputedContracts,
    penalizedContracts,
    citizensCount,
    votingProposalsTotal,
    totalTreasuryBalance: totalBalance.toString(),
    treasuries: treasuryRows,
    recentContracts: recentContracts.map((c) => ({
      id: c.id,
      title: c.title,
      district: c.district,
      status: c.status,
      totalAmount: c.totalAmount.toString(),
      createdAt: c.createdAt.toISOString(),
      contractorName: c.contractor.name,
    })),
  })
}
