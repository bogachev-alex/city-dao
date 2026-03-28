import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/jury?sessionId=... — get jury session details
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')

  if (sessionId) {
    const session = await prisma.jurySession.findUnique({
      where: { id: sessionId },
      include: {
        contract: { select: { id: true, title: true, district: true } },
        milestone: { select: { id: true, description: true } },
        votes: {
          include: { citizen: { select: { id: true, walletAddress: true, tier: true } } },
        },
      },
    })
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

  const juryVote = await prisma.juryVote.findFirst({
    where: { sessionId, citizenId },
  })
  if (!juryVote) {
    return NextResponse.json({ error: 'Not a juror in this session' }, { status: 403 })
  }
  if (!juryVote.commitHash) {
    return NextResponse.json({ error: 'Must commit before reveal' }, { status: 400 })
  }

  // TODO: verify hash(vote + salt) === commitHash on-chain
  // For now, trust the client (will be enforced by smart contract)

  const updated = await prisma.juryVote.update({
    where: { id: juryVote.id },
    data: { revealedVote: vote, revealedSalt: salt },
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
