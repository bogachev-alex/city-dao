import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  fetchDistrictTreasuryBalanceOnChain,
  getReadOnlySolanaConnection,
} from '@/lib/web3/fetchDistrictTreasuryBalance'
import { getTreasuryPDA } from '@/lib/web3/pda'

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
      penalties: {
        include: {
          contract: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!treasury) {
    return NextResponse.json({ error: 'District not found' }, { status: 404 })
  }

  const balanceOnChain = await fetchDistrictTreasuryBalanceOnChain(
    getReadOnlySolanaConnection(),
    decodedDistrict
  )

  let pdaAddress: string | null = null
  try {
    const [pda] = getTreasuryPDA(decodedDistrict)
    pdaAddress = pda.toBase58()
  } catch {}

  return NextResponse.json({
    ...treasury,
    balance: treasury.balance.toString(),
    balanceOnChain: balanceOnChain !== null ? balanceOnChain.toString() : null,
    pdaAddress,
    totalPenaltyIncome: treasury.penalties.reduce((s, p) => s + Number(p.amountTenge), 0),
    proposals: treasury.proposals.map((p) => ({
      ...p,
      amount: typeof p.amount === 'bigint' ? p.amount.toString() : p.amount,
    })),
    penalties: treasury.penalties.map((p) => ({
      ...p,
      amountTenge: typeof p.amountTenge === 'bigint' ? p.amountTenge.toString() : p.amountTenge,
    })),
  })
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
