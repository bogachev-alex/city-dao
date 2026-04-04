import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-server'
import { PLACEHOLDER_CONTRACTOR_NAME } from '@/lib/crowdfundingContractConstants'

export const dynamic = 'force-dynamic'

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  ) as T
}

/** GET /api/akimat/crowdfunding-queue — contracts from crowdfunding awaiting real contractor (AKIMAT) */
export async function GET(req: NextRequest) {
  const denied = requireRole(req, ['AKIMAT'])
  if (denied) return denied

  const [queue, contractors] = await Promise.all([
    prisma.contract.findMany({
      where: {
        crowdfunding: { isNot: null },
        contractor: { name: PLACEHOLDER_CONTRACTOR_NAME },
      },
      include: {
        contractor: { select: { id: true, name: true } },
        milestones: {
          orderBy: { sortOrder: 'asc' },
          select: { description: true, deadlineDays: true, tranchePct: true, sortOrder: true },
        },
        crowdfunding: {
          select: {
            id: true,
            title: true,
            district: true,
            status: true,
            citizenRaised: true,
            citizenTarget: true,
            stateDeposited: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contractor.findMany({
      where: { name: { not: PLACEHOLDER_CONTRACTOR_NAME } },
      select: { id: true, name: true, walletAddress: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json(toJsonSafe({ queue, contractors }))
}
