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

async function ensureJurySessionForTesting(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      milestones: { orderBy: { sortOrder: 'asc' } },
      jurySessions: {
        where: { status: { in: ['SELECTING', 'COMMIT_PHASE', 'REVEAL_PHASE'] } },
        select: { id: true },
      },
    },
  })
  if (!contract) return
  if ((contract.jurySessions || []).length > 0) return

  const milestone = (contract.milestones || []).find(
    (m) => m.status === 'PENDING' || m.status === 'SUBMITTED' || m.status === 'UNDER_REVIEW'
  )
  if (!milestone) return

  const jurors = await prisma.citizen.findMany({
    where: { district: contract.district },
    orderBy: { reputationScore: 'desc' },
    take: 5,
  })
  if (jurors.length === 0) return

  const now = new Date()
  const commitDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const revealDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000)

  await prisma.jurySession.create({
    data: {
      contractId: contract.id,
      milestoneId: milestone.id,
      status: 'COMMIT_PHASE',
      commitDeadline,
      revealDeadline,
      votes: {
        create: jurors.map((c, idx) => ({
          citizenId: c.id,
          weight: idx === 0 ? 2 : 1,
          isExpert: idx === 0,
        })),
      },
    },
  })
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

  // Resolve by Solana on-chain PDA (same address as in Explorer)
  if (!contract) {
    contract = await prisma.contract.findUnique({
      where: { onChainPubkey: id },
      include,
    })
  }

  if (contract) {
    try {
      await ensureJurySessionForTesting(contract.id)
      contract = await prisma.contract.findUnique({
        where: { id: contract.id },
        include,
      })
    } catch {
      // Keep response working even if bootstrap fails.
    }
  }

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  return NextResponse.json(toJsonSafe(contract))
}

// PATCH /api/contracts/[id] — update contract (AKIMAT only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireRole(req, ['AKIMAT'])
  if (denied) return denied

  const { id } = await params
  const body = await req.json()

  const existing = await prisma.contract.findUnique({
    where: { id },
    include: { crowdfunding: { select: { id: true } }, contractor: { select: { id: true, name: true } } },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  let contractorId = body.contractorId as string | undefined
  if (!contractorId && body.contractorName) {
    const found = await prisma.contractor.findFirst({
      where: { name: String(body.contractorName) },
    })
    if (found) {
      contractorId = found.id
    } else {
      const created = await prisma.contractor.create({
        data: { name: String(body.contractorName) },
      })
      contractorId = created.id
    }
  }

  if (contractorId) {
    if (!existing.crowdfunding) {
      return NextResponse.json(
        { error: 'contractorId can only be set via this route for contracts linked to a crowdfunding campaign' },
        { status: 400 }
      )
    }
    if (existing.contractor?.name !== PLACEHOLDER_CONTRACTOR_NAME) {
      return NextResponse.json(
        { error: 'Contractor is already assigned (only placeholder can be replaced here)' },
        { status: 400 }
      )
    }
    const next = await prisma.contractor.findUnique({ where: { id: contractorId } })
    if (!next || next.name === PLACEHOLDER_CONTRACTOR_NAME) {
      return NextResponse.json({ error: 'Invalid contractorId' }, { status: 400 })
    }
  }

  const contract = await prisma.contract.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.penaltyAmount !== undefined && { penaltyAmount: BigInt(body.penaltyAmount) }),
      ...(body.onChainPubkey && { onChainPubkey: body.onChainPubkey }),
      ...(contractorId && { contractorId }),
    },
    include: { contractor: { select: { id: true, name: true } }, crowdfunding: { select: { id: true } } },
  })

  return NextResponse.json(toJsonSafe(contract))
}
