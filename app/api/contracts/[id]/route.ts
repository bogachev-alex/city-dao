import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/contracts/[id] — contract detail with milestones, jury, penalties, work logs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      contractor: true,
      milestones: { orderBy: { sortOrder: 'asc' } },
      jurySessions: {
        include: { votes: { include: { citizen: { select: { id: true, walletAddress: true, tier: true } } } } },
        orderBy: { createdAt: 'desc' },
      },
      penalties: { orderBy: { createdAt: 'desc' } },
      workLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  return NextResponse.json(contract)
}

// PATCH /api/contracts/[id] — update contract status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const contract = await prisma.contract.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.penaltyAmount !== undefined && { penaltyAmount: BigInt(body.penaltyAmount) }),
    },
  })

  return NextResponse.json(contract)
}
