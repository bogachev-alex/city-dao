import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CitizenTier } from '@/lib/generated/prisma'

export const dynamic = 'force-dynamic'

function computeTier(score: number): CitizenTier {
  if (score >= 300) return 'GUARDIAN'
  if (score >= 150) return 'TRUSTED'
  if (score >= 50) return 'ACTIVE'
  return 'NEW'
}

// GET /api/citizens?wallet=... — get citizen by wallet
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')

  if (wallet) {
    const citizen = await prisma.citizen.findUnique({
      where: { walletAddress: wallet },
      include: {
        nfts: true,
        juryVotes: { include: { session: { select: { id: true, status: true, result: true } } } },
      },
    })
    if (!citizen) {
      return NextResponse.json({ error: 'Citizen not found' }, { status: 404 })
    }
    return NextResponse.json(citizen)
  }

  const citizens = await prisma.citizen.findMany({
    orderBy: { reputationScore: 'desc' },
    take: 50,
  })
  return NextResponse.json(citizens)
}

// POST /api/citizens — register a new citizen
export async function POST(req: NextRequest) {
  const { walletAddress, district, iinHash } = await req.json()

  const existing = await prisma.citizen.findFirst({
    where: { OR: [{ walletAddress }, { iinHash }] },
  })
  if (existing) {
    return NextResponse.json(
      { error: existing.walletAddress === walletAddress ? 'Wallet already registered' : 'IIN already registered' },
      { status: 409 }
    )
  }

  const citizen = await prisma.citizen.create({
    data: { walletAddress, district, iinHash },
  })

  return NextResponse.json(citizen, { status: 201 })
}

// PATCH /api/citizens — update reputation
export async function PATCH(req: NextRequest) {
  const { walletAddress, reputationDelta } = await req.json()

  const citizen = await prisma.citizen.findUnique({ where: { walletAddress } })
  if (!citizen) {
    return NextResponse.json({ error: 'Citizen not found' }, { status: 404 })
  }

  const newScore = Math.max(0, citizen.reputationScore + reputationDelta)

  const updated = await prisma.citizen.update({
    where: { walletAddress },
    data: {
      reputationScore: newScore,
      tier: computeTier(newScore),
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/citizens — delete citizen by wallet (test utility)
export async function DELETE(req: NextRequest) {
  const { walletAddress } = await req.json()
  if (!walletAddress || typeof walletAddress !== 'string') {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })
  }

  const citizen = await prisma.citizen.findUnique({ where: { walletAddress } })
  if (!citizen) {
    return NextResponse.json({ error: 'Citizen not found' }, { status: 404 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.juryVote.deleteMany({ where: { citizenId: citizen.id } })
      await tx.suggestionVote.deleteMany({ where: { citizenId: citizen.id } })
      await tx.proposalVote.deleteMany({ where: { citizenId: citizen.id } })
      await tx.campaignContribution.deleteMany({ where: { citizenId: citizen.id } })
      await tx.citizenNft.deleteMany({ where: { citizenId: citizen.id } })
      await tx.citizenSuggestion.deleteMany({ where: { citizenId: citizen.id } })
      await tx.crowdfundingCampaign.deleteMany({ where: { creatorId: citizen.id } })
      await tx.citizen.delete({ where: { id: citizen.id } })
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to delete citizen' },
      { status: 500 }
    )
  }
}
