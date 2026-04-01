import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthPayload, requireRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const JURORS = 3
const HOUR_MS = 60 * 60 * 1000

/**
 * POST /api/contracts/[id]/milestones/[milestoneId]/submit
 * Contractor submits milestone for jury review; creates a minimal JurySession + juror slots.
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
    include: { milestones: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }
  if (contract.contractorId !== auth.id) {
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

  const activeSession = await prisma.jurySession.findFirst({
    where: {
      milestoneId,
      status: { in: ['SELECTING', 'COMMIT_PHASE', 'REVEAL_PHASE'] },
    },
  })
  if (activeSession) {
    return NextResponse.json({ error: 'Jury session already active for this milestone' }, { status: 409 })
  }

  const jurors = await pickJurors(contract.district, JURORS)
  if (jurors.length < JURORS) {
    return NextResponse.json(
      { error: 'Not enough citizens registered to form a jury' },
      { status: 503 }
    )
  }

  const now = Date.now()
  const commitDeadline = new Date(now + 48 * HOUR_MS)
  const revealDeadline = new Date(now + 72 * HOUR_MS)

  const photoHashes = Array.isArray(body.photoHashes)
    ? body.photoHashes.filter((h): h is string => typeof h === 'string')
    : []

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
        votes: {
          create: jurors.map((citizenId, i) => ({
            citizenId,
            isExpert: i === 0,
            weight: i === 0 ? 2 : 1,
          })),
        },
      },
      include: { votes: true },
    })

    await tx.workLog.create({
      data: {
        contractId,
        contractorId: contract.contractorId,
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

async function pickJurors(district: string, count: number): Promise<string[]> {
  const local = await prisma.citizen.findMany({
    where: { district, isEligible: true },
    take: count,
    orderBy: { reputationScore: 'desc' },
    select: { id: true },
  })
  if (local.length >= count) {
    return local.map((c) => c.id)
  }
  const rest = await prisma.citizen.findMany({
    where: {
      isEligible: true,
      id: { notIn: local.map((c) => c.id) },
    },
    take: count - local.length,
    orderBy: { reputationScore: 'desc' },
    select: { id: true },
  })
  return [...local, ...rest].map((c) => c.id)
}
