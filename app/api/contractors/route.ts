import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/contractors — leaderboard / list
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: {
        contracts: {
          include: { milestones: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        },
        workLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
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
