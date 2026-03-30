import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const contractorDetailInclude = {
  contracts: {
    include: { milestones: { orderBy: { sortOrder: 'asc' as const } } },
    orderBy: { createdAt: 'desc' as const },
  },
  workLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 15,
    include: {
      contract: { select: { id: true, title: true, district: true } },
    },
  },
} as const

// GET /api/contractors — leaderboard / list, or single contractor by id / name / demo id
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const name = req.nextUrl.searchParams.get('name')

  if (id || name) {
    let contractor = null

    if (id === 'demo-contractor-1') {
      contractor = await prisma.contractor.findFirst({
        where: { name: 'ТОО СтройАлматы' },
        include: contractorDetailInclude,
      })
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
