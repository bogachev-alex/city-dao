import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import type { Prisma } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { getAuthPayload, requireRole } from '@/lib/auth-server'
import { isSolanaAddress } from '@/lib/blockchainDashboardModel'
import { getIpfsUrl } from '@/lib/pinata'

export const dynamic = 'force-dynamic'

const sessionInclude = {
  contract: { select: { id: true, title: true, district: true, onChainPubkey: true } },
  milestone: { select: { id: true, description: true } },
  votes: {
    include: { citizen: { select: { id: true, walletAddress: true, tier: true } } },
  },
} satisfies Prisma.JurySessionInclude

type SessionRow = Prisma.JurySessionGetPayload<{ include: typeof sessionInclude }>

function parsePhotoHashes(json: unknown): string[] {
  if (!Array.isArray(json)) return []
  return json.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

async function enrichJurySessionForClient(session: SessionRow) {
  const milestones = await prisma.milestone.findMany({
    where: { contractId: session.contractId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  })
  const milestoneIndexOnChain = Math.max(0, milestones.findIndex((m) => m.id === session.milestoneId))

  const evidenceLog = await prisma.workLog.findFirst({
    where: {
      contractId: session.contractId,
      milestoneId: session.milestoneId,
      type: 'MILESTONE_CLAIM',
    },
    orderBy: { createdAt: 'desc' },
    select: { photoHashes: true },
  })
  let cids = parsePhotoHashes(evidenceLog?.photoHashes)
  if (!cids.length) {
    const snippet = (session.milestone.description || '').trim().slice(0, 40)
    const legacyRows = await prisma.workLog.findMany({
      where: { contractId: session.contractId, type: 'MILESTONE_CLAIM' },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { photoHashes: true, title: true },
    })
    const byTitle =
      snippet.length > 0
        ? legacyRows.find((r) => typeof r.title === 'string' && r.title.includes(snippet))
        : undefined
    const byPhotos = legacyRows.find((r) => parsePhotoHashes(r.photoHashes).length > 0)
    const fallback = byTitle || byPhotos
    cids = parsePhotoHashes(fallback?.photoHashes)
  }
  const evidencePhotoUrls = cids.slice(0, 8).map(getIpfsUrl)

  return {
    ...session,
    milestoneIndexOnChain,
    evidencePhotoUrls,
  }
}

async function resolveSession(sessionId: string): Promise<SessionRow | null> {
  // Primary lookup by real JurySession.id
  const direct = await prisma.jurySession.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  })
  if (direct) return direct

  // Legacy/friendly aliases: "contractId-milestoneId" or "contractId-milestoneId-sessionIndex"
  const parts = sessionId.split('-').filter(Boolean)
  if (parts.length < 2) return null

  const contractId = parts[0]
  const milestoneToken = parts[1]

  let candidates = await prisma.jurySession.findMany({
    where: { contractId, milestoneId: milestoneToken },
    include: sessionInclude,
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
        include: sessionInclude,
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

async function createSessionFromLegacyAlias(sessionId: string): Promise<SessionRow | null> {
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
    include: sessionInclude,
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing

  const session = await prisma.jurySession.create({
    data: {
      contractId: contract.id,
      milestoneId: milestone.id,
      status: 'COMMIT_PHASE',
      commitDeadline,
      revealDeadline,
    },
    include: sessionInclude,
  })

  return session
}

/** Resolve DB citizen id for jury actions (wallet auth only). */
async function resolveJuryCitizenId(req: NextRequest): Promise<{ citizenId: string } | NextResponse> {
  const roleDeny = requireRole(req, ['CITIZEN'])
  if (roleDeny) return roleDeny

  const auth = getAuthPayload(req)
  if (!auth?.id || !isSolanaAddress(auth.id)) {
    return NextResponse.json(
      { error: 'Wallet login required: jury voting uses your registered citizen wallet address' },
      { status: 403 },
    )
  }

  const citizen = await prisma.citizen.findUnique({
    where: { walletAddress: auth.id },
    select: { id: true },
  })
  if (!citizen) {
    return NextResponse.json({ error: 'No citizen registered for this wallet' }, { status: 403 })
  }

  return { citizenId: citizen.id }
}

async function resolveSessionForMutation(sessionId: string): Promise<SessionRow | NextResponse> {
  let session = await resolveSession(sessionId)
  if (!session) {
    session = await createSessionFromLegacyAlias(sessionId)
  }
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  return session
}

function tallyRevealedVotes(
  votes: { revealedVote: 'ACCEPT' | 'REJECT' | null; weight: number }[],
): { weightedAccept: number; weightedReject: number } {
  let weightedAccept = 0
  let weightedReject = 0
  for (const v of votes) {
    if (v.revealedVote === 'ACCEPT') weightedAccept += v.weight
    else if (v.revealedVote === 'REJECT') weightedReject += v.weight
  }
  return { weightedAccept, weightedReject }
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
    const payload = await enrichJurySessionForClient(session)
    return NextResponse.json(payload)
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

// POST /api/jury — submit vote commitment (citizen derived from wallet auth)
export async function POST(req: NextRequest) {
  const resolved = await resolveJuryCitizenId(req)
  if (resolved instanceof NextResponse) return resolved
  const { citizenId } = resolved

  const { sessionId, commitHash } = await req.json()
  if (!sessionId || typeof commitHash !== 'string' || !commitHash) {
    return NextResponse.json({ error: 'sessionId and commitHash required' }, { status: 400 })
  }

  const sessionRow = await resolveSessionForMutation(sessionId)
  if (sessionRow instanceof NextResponse) return sessionRow
  const realSessionId = sessionRow.id

  if (sessionRow.status !== 'COMMIT_PHASE') {
    return NextResponse.json({ error: 'Commit phase is closed for this session' }, { status: 400 })
  }
  if (sessionRow.commitDeadline && new Date(sessionRow.commitDeadline).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Commit deadline has passed' }, { status: 400 })
  }

  let vote = await prisma.juryVote.findFirst({
    where: { sessionId: realSessionId, citizenId },
  })
  if (!vote) {
    const citizen = await prisma.citizen.findUnique({
      where: { id: citizenId },
      select: { isEligible: true, banUntil: true },
    })
    if (!citizen?.isEligible) {
      return NextResponse.json({ error: 'Citizen is not eligible to vote' }, { status: 403 })
    }
    if (citizen.banUntil && new Date(citizen.banUntil) > new Date()) {
      return NextResponse.json({ error: 'Citizen is not eligible to vote' }, { status: 403 })
    }
    vote = await prisma.juryVote.create({
      data: {
        sessionId: realSessionId,
        citizenId,
        weight: 1,
        isExpert: false,
      },
    })
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
  const resolved = await resolveJuryCitizenId(req)
  if (resolved instanceof NextResponse) return resolved
  const { citizenId } = resolved

  const { sessionId, vote, salt } = await req.json()
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const normalizedVote = String(vote).toLowerCase()
  if (normalizedVote !== 'accept' && normalizedVote !== 'reject') {
    return NextResponse.json({ error: 'Invalid vote value' }, { status: 400 })
  }
  const voteEnum = normalizedVote === 'accept' ? 'ACCEPT' : 'REJECT'

  const sessionRow = await resolveSessionForMutation(sessionId)
  if (sessionRow instanceof NextResponse) return sessionRow
  const realSessionId = sessionRow.id

  const juryVote = await prisma.juryVote.findFirst({
    where: { sessionId: realSessionId, citizenId },
  })
  if (!juryVote) {
    return NextResponse.json({ error: 'No vote commitment found for this session' }, { status: 403 })
  }
  if (!juryVote.commitHash) {
    return NextResponse.json({ error: 'Must commit before reveal' }, { status: 400 })
  }

  const computedHash = createHash('sha256').update(`${normalizedVote}:${salt}`).digest('hex')
  if (computedHash !== juryVote.commitHash) {
    return NextResponse.json({ error: 'Hash mismatch: vote/salt does not match commitment' }, { status: 400 })
  }

  await prisma.juryVote.update({
    where: { id: juryVote.id },
    data: { revealedVote: voteEnum, revealedSalt: salt },
  })

  const updated = await prisma.juryVote.findUnique({ where: { id: juryVote.id } })

  const allVotes = await prisma.juryVote.findMany({
    where: { sessionId: realSessionId },
  })

  const sessionMeta = await prisma.jurySession.findUnique({
    where: { id: realSessionId },
    select: { status: true, milestoneId: true },
  })
  if (!sessionMeta) {
    return NextResponse.json(updated)
  }
  if (sessionMeta.status === 'FINALIZED' || sessionMeta.status === 'ESCALATED') {
    return NextResponse.json(updated)
  }

  const revealedVotes = allVotes.filter((v) => v.revealedVote !== null)
  // One revealed vote is enough to finalize (open jury; no fixed panel size).
  if (revealedVotes.length < 1) {
    return NextResponse.json(updated)
  }
  if (sessionMeta.status !== 'COMMIT_PHASE' && sessionMeta.status !== 'REVEAL_PHASE') {
    return NextResponse.json(updated)
  }

  const { weightedAccept, weightedReject } = tallyRevealedVotes(allVotes)

  let result: 'ACCEPT' | 'REJECT' | null
  let status: 'FINALIZED' | 'ESCALATED'

  if (weightedAccept > weightedReject) {
    result = 'ACCEPT'
    status = 'FINALIZED'
  } else if (weightedReject > weightedAccept) {
    result = 'REJECT'
    status = 'FINALIZED'
  } else {
    status = 'ESCALATED'
    result = null
  }

  await prisma.$transaction(async (tx) => {
    await tx.jurySession.update({
      where: { id: realSessionId },
      data: { status, result, weightedAccept, weightedReject },
    })

    if (status === 'FINALIZED' && result === 'ACCEPT') {
      await tx.milestone.update({
        where: { id: sessionMeta.milestoneId },
        data: { status: 'ACCEPTED' },
      })
      const contractId = sessionRow.contractId
      const milestoneTotal = await tx.milestone.count({ where: { contractId } })
      if (milestoneTotal > 0) {
        const acceptedTotal = await tx.milestone.count({
          where: { contractId, status: 'ACCEPTED' },
        })
        if (acceptedTotal === milestoneTotal) {
          // Off-chain completion. Actual SOL transfer to the contractor still requires an
          // on-chain `accept_milestone` (authority wallet) per milestone — see contract_registry program.
          await tx.contract.update({
            where: { id: contractId },
            data: {
              status: 'COMPLETED',
              escrowAmount: BigInt(0),
            },
          })
        }
      }
    } else if (status === 'FINALIZED' && result === 'REJECT') {
      await tx.milestone.update({
        where: { id: sessionMeta.milestoneId },
        data: { status: 'REJECTED' },
      })
    }
  })

  return NextResponse.json(updated)
}
