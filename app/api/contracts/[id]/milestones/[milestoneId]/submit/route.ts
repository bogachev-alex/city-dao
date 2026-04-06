import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthPayload, requireRole } from '@/lib/auth-server'
import { ownsContract } from '@/lib/ownsContract'

export const dynamic = 'force-dynamic'

const HOUR_MS = 60 * 60 * 1000

/**
 * POST /api/contracts/[id]/milestones/[milestoneId]/submit
 * Contractor submits milestone for jury review; creates JurySession (any registered citizen may vote).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const denied = requireRole(req, ['CONTRACTOR'])
  if (denied) return denied

  const auth = getAuthPayload(req)
  if (!auth?.id) {
    return NextResponse.json({ error: 'Unauthorized: missing user id' }, { status: 401 })
  }

  const { id: contractId, milestoneId } = await params

  let body: { photoHashes?: string[]; evidenceNote?: string }
  try {
    body = (await req.json()) as { photoHashes?: string[]; evidenceNote?: string }
  } catch {
    body = {}
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      contractor: { select: { name: true, walletAddress: true } },
      milestones: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }
  if (!contract.contractorId) {
    return NextResponse.json({ error: 'Contract has no contractor assigned' }, { status: 400 })
  }
  if (!ownsContract(auth.id, contract.contractorId, contract.contractor?.name, contract.contractor?.walletAddress)) {
    return NextResponse.json({ error: 'Forbidden: not your contract' }, { status: 403 })
  }

  const milestone = contract.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  }

  if (!['PENDING', 'SUBMITTED'].includes(milestone.status)) {
    return NextResponse.json(
      { error: `Cannot submit milestone in status ${milestone.status}` },
      { status: 400 }
    )
  }

  const staleSessionIds = await prisma.jurySession.findMany({
    where: {
      milestoneId,
      status: { in: ['SELECTING', 'COMMIT_PHASE', 'REVEAL_PHASE'] },
    },
    select: { id: true },
  })
  if (staleSessionIds.length > 0) {
    const ids = staleSessionIds.map((s) => s.id)
    await prisma.$transaction([
      prisma.juryVote.deleteMany({ where: { sessionId: { in: ids } } }),
      prisma.jurySession.deleteMany({ where: { id: { in: ids } } }),
    ])
  }

  const now = Date.now()
  const commitDeadline = new Date(now + 48 * HOUR_MS)
  const revealDeadline = new Date(now + 72 * HOUR_MS)

  const photoHashes = Array.isArray(body.photoHashes)
    ? body.photoHashes.filter((h): h is string => typeof h === 'string')
    : []

  const workLogContractorId = contract.contractorId as string

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.milestone.update({
      where: { id: milestoneId },
      data: { status: 'UNDER_REVIEW' },
    })

    const session = await tx.jurySession.create({
      data: {
        contractId,
        milestoneId,
        status: 'COMMIT_PHASE',
        commitDeadline,
        revealDeadline,
      },
      include: { votes: true },
    })

    await tx.workLog.create({
      data: {
        contractId,
        contractorId: workLogContractorId,
        milestoneId,
        type: 'MILESTONE_CLAIM',
        title: `Сдача этапа: ${milestone.description.slice(0, 80)}`,
        description: body.evidenceNote?.trim() || 'Материалы переданы на проверку жюри.',
        completionPct: 100,
        photoHashes: photoHashes.length ? photoHashes : undefined,
        gpsValid: false,
      },
    })

    return { milestone: updated, session }
  })

  return NextResponse.json(result, { status: 201 })
}
