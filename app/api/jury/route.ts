import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function resolveSession(sessionId: string) {
  const include = {
    contract: { select: { id: true, title: true, district: true, onChainPubkey: true } },
    milestone: { select: { id: true, description: true } },
    votes: {
      include: { citizen: { select: { id: true, walletAddress: true, tier: true } } },
    },
  } as const

  // Primary lookup by real JurySession.id
  const direct = await prisma.jurySession.findUnique({
    where: { id: sessionId },
    include,
  })
  if (direct) return direct

  // Legacy/friendly aliases: "contractId-milestoneId" or "contractId-milestoneId-sessionIndex"
  const parts = sessionId.split('-').filter(Boolean)
  if (parts.length < 2) return null

  const contractId = parts[0]
  const milestoneToken = parts[1]

  let candidates = await prisma.jurySession.findMany({
    where: { contractId, milestoneId: milestoneToken },
    include,
    orderBy: { createdAt: 'asc' },
  })

  // Fallback for aliases like "contractId-milestoneSortOrder-sessionIndex" (e.g. "1-1-2")
  if (candidates.length === 0) {
    const milestoneSortOrder = Number(milestoneToken)
    if (Number.isInteger(milestoneSortOrder) && milestoneSortOrder > 0) {
      candidates = await prisma.jurySession.findMany({
        where: {
          contractId,
          milestone: {
            sortOrder: milestoneSortOrder,
          },
        },
        include,
        orderBy: { createdAt: 'asc' },
      })
    }
  }

  if (candidates.length === 0) return null

  if (parts.length >= 3) {
    const idx = Number(parts[2])
    if (Number.isInteger(idx) && idx >= 1 && idx <= candidates.length) {
      return candidates[idx - 1]
    }
  }

  return candidates[candidates.length - 1]
}

async function createSessionFromLegacyAlias(sessionId: string) {
  const parts = sessionId.split('-').filter(Boolean)
  if (parts.length < 2) return null

  const contractId = parts[0]
  const milestoneSortOrder = Number(parts[1])
  if (!Number.isInteger(milestoneSortOrder) || milestoneSortOrder <= 0) return null

  let contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      milestones: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!contract) {
    const contractIndex = Number(contractId)
    if (Number.isInteger(contractIndex) && contractIndex > 0) {
      const list = await prisma.contract.findMany({
        include: {
          milestones: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
        take: contractIndex,
      })
      contract = list[contractIndex - 1] || null
    }
  }
  if (!contract) return null

  const milestone = contract.milestones.find((m) => m.sortOrder === milestoneSortOrder)
  if (!milestone) return null

  const now = new Date()
  const commitDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const revealDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000)

  // Re-check after lookup to avoid duplicates in concurrent requests.
  const existing = await prisma.jurySession.findFirst({
    where: { contractId: contract.id, milestoneId: milestone.id },
    include: {
      contract: { select: { id: true, title: true, district: true, onChainPubkey: true } },
      milestone: { select: { id: true, description: true } },
      votes: {
        include: { citizen: { select: { id: true, walletAddress: true, tier: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing

  const jurors = await prisma.citizen.findMany({
    where: { district: contract.district },
    orderBy: { reputationScore: 'desc' },
    take: 5,
  })

  const session = await prisma.jurySession.create({
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
    include: {
      contract: { select: { id: true, title: true, district: true, onChainPubkey: true } },
      milestone: { select: { id: true, description: true } },
      votes: {
        include: { citizen: { select: { id: true, walletAddress: true, tier: true } } },
      },
    },
  })

  return session
}

// GET /api/jury?sessionId=... — get jury session details
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')

  if (sessionId) {
    let session = await resolveSession(sessionId)
    if (!session) {
      session = await createSessionFromLegacyAlias(sessionId)
    }
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json(session)
  }

  // List active sessions
  const sessions = await prisma.jurySession.findMany({
    where: { status: { in: ['COMMIT_PHASE', 'REVEAL_PHASE'] } },
    include: {
      contract: { select: { id: true, title: true, district: true } },
      milestone: { select: { id: true, description: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(sessions)
}

// POST /api/jury/commit — submit vote commitment
export async function POST(req: NextRequest) {
  const { sessionId, citizenId, commitHash } = await req.json()

  const vote = await prisma.juryVote.findFirst({
    where: { sessionId, citizenId },
  })
  if (!vote) {
    return NextResponse.json({ error: 'Not a juror in this session' }, { status: 403 })
  }
  if (vote.commitHash) {
    return NextResponse.json({ error: 'Already committed' }, { status: 409 })
  }

  const updated = await prisma.juryVote.update({
    where: { id: vote.id },
    data: { commitHash },
  })

  return NextResponse.json(updated)
}

// PATCH /api/jury — reveal vote
export async function PATCH(req: NextRequest) {
  const { sessionId, citizenId, vote, salt } = await req.json()
  const normalizedVote = String(vote).toLowerCase()
  if (normalizedVote !== 'accept' && normalizedVote !== 'reject') {
    return NextResponse.json({ error: 'Invalid vote value' }, { status: 400 })
  }
  const voteEnum = normalizedVote === 'accept' ? 'ACCEPT' : 'REJECT'

  const juryVote = await prisma.juryVote.findFirst({
    where: { sessionId, citizenId },
  })
  if (!juryVote) {
    return NextResponse.json({ error: 'Not a juror in this session' }, { status: 403 })
  }
  if (!juryVote.commitHash) {
    return NextResponse.json({ error: 'Must commit before reveal' }, { status: 400 })
  }

  // Verify commit-reveal: normalize vote to lowercase to match client commit format.
  const computedHash = createHash('sha256').update(`${normalizedVote}:${salt}`).digest('hex')
  if (computedHash !== juryVote.commitHash) {
    return NextResponse.json({ error: 'Hash mismatch: vote/salt does not match commitment' }, { status: 400 })
  }

  const updated = await prisma.juryVote.update({
    where: { id: juryVote.id },
    data: { revealedVote: voteEnum, revealedSalt: salt },
  })

  // Check if all votes revealed — if so, finalize
  const allVotes = await prisma.juryVote.findMany({
    where: { sessionId },
  })
  const allRevealed = allVotes.every((v) => v.revealedVote !== null)

  if (allRevealed) {
    let weightedAccept = 0
    let weightedReject = 0
    for (const v of allVotes) {
      if (v.revealedVote === 'ACCEPT') weightedAccept += v.weight
      else weightedReject += v.weight
    }

    const result = weightedAccept >= 3 ? 'ACCEPT' : 'REJECT'
    const status = weightedAccept === 2 && weightedReject === 2 ? 'ESCALATED' : 'FINALIZED'

    await prisma.jurySession.update({
      where: { id: sessionId },
      data: { status, result, weightedAccept, weightedReject },
    })
  }

  return NextResponse.json(updated)
}
