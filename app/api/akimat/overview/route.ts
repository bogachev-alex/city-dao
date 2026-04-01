import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  fetchDistrictTreasuryBalanceOnChain,
  getReadOnlySolanaConnection,
} from '@/lib/web3/fetchDistrictTreasuryBalance'
import { fetchGovernmentContractsOnChainCount } from '@/lib/web3/fetchGovernmentContractsCount'

export const dynamic = 'force-dynamic'

/** GET /api/akimat/overview — сводка для кабинета акимата: контракты, казны, граждане, последние контракты */
export async function GET() {
  const connection = getReadOnlySolanaConnection()
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

  const [contractsOnChain, districtTreasuryBalancesOnChain] = await Promise.all([
    fetchGovernmentContractsOnChainCount(connection),
    Promise.all(
      treasuries.map((t) => fetchDistrictTreasuryBalanceOnChain(connection, t.district))
    ),
  ])

  let totalBalance = BigInt(0)
  const treasuryRows = treasuries.map((t, i) => {
    const onChain = districtTreasuryBalancesOnChain[i]
    const balance = onChain !== null ? onChain : t.balance
    totalBalance += balance
    return {
      district: t.district,
      balance: balance.toString(),
      votingCount: t.proposals.length,
    }
  })

  const votingProposalsTotal = treasuries.reduce((s, t) => s + t.proposals.length, 0)

  return NextResponse.json({
    totalContracts,
    contractsOnChain,
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
