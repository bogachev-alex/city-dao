import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  ) as T
}

// GET /api/contracts/[id] — contract detail with milestones, jury, penalties, work logs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const include = {
    contractor: true,
    milestones: { orderBy: { sortOrder: 'asc' as const } },
    jurySessions: {
      include: {
        milestone: { select: { id: true, description: true } },
        votes: { include: { citizen: { select: { id: true, walletAddress: true, tier: true } } } },
      },
      orderBy: { createdAt: 'desc' as const },
    },
    penalties: { orderBy: { createdAt: 'desc' as const } },
    workLogs: { orderBy: { createdAt: 'desc' as const }, take: 20 },
  }

  let contract = await prisma.contract.findUnique({
    where: { id },
    include,
  })

  // Legacy compatibility: allow numeric aliases like /api/contracts/1
  if (!contract) {
    const idx = Number(id)
    if (Number.isInteger(idx) && idx > 0) {
      const list = await prisma.contract.findMany({
        include,
        orderBy: { createdAt: 'asc' },
        take: idx,
      })
      contract = list[idx - 1] || null
    }
  }

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  return NextResponse.json(toJsonSafe(contract))
}

// PATCH /api/contracts/[id] — update contract status (AKIMAT only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireRole(req, ['AKIMAT'])
  if (denied) return denied

  const { id } = await params
  const body = await req.json()

  const contract = await prisma.contract.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.penaltyAmount !== undefined && { penaltyAmount: BigInt(body.penaltyAmount) }),
      ...(body.onChainPubkey && { onChainPubkey: body.onChainPubkey }),
    },
  })

  return NextResponse.json(toJsonSafe(contract))
}
