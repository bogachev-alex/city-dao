import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/treasury/[district] — district treasury with proposals and AI reports
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ district: string }> }
) {
  const { district } = await params
  const decodedDistrict = decodeURIComponent(district)

  const treasury = await prisma.districtTreasury.findUnique({
    where: { district: decodedDistrict },
    include: {
      proposals: {
        include: {
          aiResearch: true,
          votes: {
            select: {
              id: true,
              citizenId: true,
              inFavor: true,
              createdAt: true,
              citizen: { select: { walletAddress: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!treasury) {
    return NextResponse.json({ error: 'District not found' }, { status: 404 })
  }

  return NextResponse.json(treasury)
}

// POST /api/treasury/[district] — create spending proposal
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ district: string }> }
) {
  const { district } = await params
  const decodedDistrict = decodeURIComponent(district)
  const body = await req.json()

  const treasury = await prisma.districtTreasury.findUnique({
    where: { district: decodedDistrict },
  })
  if (!treasury) {
    return NextResponse.json({ error: 'District not found' }, { status: 404 })
  }

  const proposal = await prisma.spendingProposal.create({
    data: {
      treasuryId: treasury.id,
      title: body.title,
      description: body.description,
      amount: BigInt(body.amount),
      category: body.category,
      status: 'VOTING',
      votingEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  })

  return NextResponse.json(proposal, { status: 201 })
}

// PATCH /api/treasury/[district] — vote on a proposal
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ district: string }> }
) {
  const body = await req.json()
  const { proposalId, citizenId, inFavor, txSignature } = body
  if (!txSignature || typeof txSignature !== 'string') {
    return NextResponse.json({ error: 'On-chain confirmation is required' }, { status: 400 })
  }

  // Check for duplicate vote
  const existing = await prisma.proposalVote.findUnique({
    where: { proposalId_citizenId: { proposalId, citizenId } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Already voted on this proposal' }, { status: 409 })
  }

  // Create vote and update proposal counters
  const [vote, proposal] = await prisma.$transaction([
    prisma.proposalVote.create({
      data: { proposalId, citizenId, inFavor },
    }),
    prisma.spendingProposal.update({
      where: { id: proposalId },
      data: inFavor
        ? { votesFor: { increment: 1 } }
        : { votesAgainst: { increment: 1 } },
    }),
  ])

  return NextResponse.json({ vote, proposal })
}
