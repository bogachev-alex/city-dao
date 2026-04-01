import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDemoContractorProfileForApi } from '@/lib/demoContractorProfile'
import type { JurySessionStatus } from '@/lib/generated/prisma'

export const dynamic = 'force-dynamic'

const ACTIVE_JURY_STATUSES: JurySessionStatus[] = [
  'SELECTING',
  'COMMIT_PHASE',
  'REVEAL_PHASE',
  'FINALIZED',
]

const contractorDetailInclude = {
  contracts: {
    include: {
      milestones: { orderBy: { sortOrder: 'asc' as const } },
      penalties: { orderBy: { createdAt: 'desc' as const }, take: 5 },
      jurySessions: {
        where: { status: { in: ACTIVE_JURY_STATUSES } },
        orderBy: { createdAt: 'desc' as const },
        take: 3,
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  workLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 15,
    include: {
      contract: { select: { id: true, title: true, district: true } },
    },
  },
}

// GET /api/contractors — leaderboard / list, or single contractor by id / name / demo id
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const name = req.nextUrl.searchParams.get('name')
  const roleHeader = req.headers.get('x-user-role')?.toUpperCase()

  if (id || name) {
    let contractor = null

    if (id === 'demo-contractor-1') {
      contractor = await prisma.contractor.findFirst({
        where: { name: 'ТОО СтройАлматы' },
        include: contractorDetailInclude,
      })
      if (!contractor) {
        return NextResponse.json(getDemoContractorProfileForApi())
      }
    } else if (id) {
      contractor = await prisma.contractor.findUnique({
        where: { id },
        include: contractorDetailInclude,
      })
    } else if (name) {
      contractor = await prisma.contractor.findFirst({
        where: { name: decodeURIComponent(name) },
        include: contractorDetailInclude,
      })
    }

    // Demo session: role switcher used to leave id as demo-citizen-* while role=CONTRACTOR
    if (
      !contractor &&
      roleHeader === 'CONTRACTOR' &&
      id?.startsWith('demo-') &&
      id !== 'demo-akimat-1'
    ) {
      return NextResponse.json(getDemoContractorProfileForApi())
    }

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }
    return NextResponse.json(contractor)
  }

  const contractors = await prisma.contractor.findMany({
    include: {
      _count: { select: { contracts: true } },
    },
    orderBy: { reputationScore: 'desc' },
  })

  return NextResponse.json(contractors)
}
