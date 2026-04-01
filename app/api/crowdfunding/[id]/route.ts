import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEMO_CAMPAIGNS } from '@/lib/crowdfunding'

export const dynamic = 'force-dynamic'

function findDemoCampaign(id: string) {
  return DEMO_CAMPAIGNS.find((c) => c.id === id) || null
}

// GET /api/crowdfunding/[id] — campaign detail with contributions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const campaign = await prisma.crowdfundingCampaign.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, walletAddress: true, district: true, tier: true, reputationScore: true } },
      contributions: {
        include: {
          citizen: { select: { id: true, walletAddress: true, district: true, tier: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      contract: { select: { id: true, title: true, status: true } },
    },
  })

  if (campaign) {
    return NextResponse.json(campaign)
  }

  const demo = findDemoCampaign(id)
  if (demo) {
    return NextResponse.json(demo)
  }

  return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
}

// POST /api/crowdfunding/[id] — contribute to a campaign
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { citizenId, amount, anonymous, txSignature } = body

  if (!citizenId || !amount) {
    return NextResponse.json({ error: 'Missing citizenId or amount' }, { status: 400 })
  }

  const amountBig = BigInt(amount)
  if (amountBig < BigInt(500)) {
    return NextResponse.json({ error: 'Minimum contribution is 500 tenge' }, { status: 400 })
  }
  if (amountBig > BigInt(500_000)) {
    return NextResponse.json({ error: 'Maximum contribution is 500,000 tenge' }, { status: 400 })
  }

  const campaign = await prisma.crowdfundingCampaign.findUnique({ where: { id } })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (campaign.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Campaign is not accepting contributions' }, { status: 400 })
  }
  if (new Date() > campaign.deadline) {
    return NextResponse.json({ error: 'Campaign deadline has passed' }, { status: 400 })
  }

  // Determine NFT tier
  let nftType: string | null = null
  if (amountBig >= BigInt(50_000)) nftType = 'DONOR_FOUNDER'
  else if (amountBig >= BigInt(5_000)) nftType = 'DONOR_PATRON'
  else nftType = 'DONOR_PARTICIPANT'

  // Transaction: create contribution + update campaign counters
  const newRaised = campaign.citizenRaised + amountBig
  const isFunded = newRaised >= campaign.citizenTarget

  const [contribution, updatedCampaign] = await prisma.$transaction([
    prisma.campaignContribution.create({
      data: {
        campaignId: id,
        citizenId,
        amount: amountBig,
        anonymous: anonymous || false,
        txSignature: txSignature || null,
      },
    }),
    prisma.crowdfundingCampaign.update({
      where: { id },
      data: {
        citizenRaised: { increment: amountBig },
        donorCount: { increment: 1 },
        ...(isFunded && campaign.status === 'ACTIVE' ? { status: 'FUNDED' } : {}),
      },
    }),
  ])

  return NextResponse.json({ contribution, campaign: updatedCampaign, nftType }, { status: 201 })
}

// PATCH /api/crowdfunding/[id] — update campaign status (match funds, link contract, expire)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { action, contractId, txSignature, onChainPubkey } = body

  const campaign = await prisma.crowdfundingCampaign.findUnique({ where: { id } })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (action === 'match') {
    // State deposits matching funds
    if (campaign.status !== 'FUNDED') {
      return NextResponse.json({ error: 'Campaign must be in FUNDED status' }, { status: 400 })
    }
    const updated = await prisma.crowdfundingCampaign.update({
      where: { id },
      data: { stateDeposited: true, status: 'MATCHED' },
    })
    return NextResponse.json(updated)
  }

  if (action === 'link_contract') {
    // Link to a government contract and start work
    if (campaign.status !== 'MATCHED') {
      return NextResponse.json({ error: 'Campaign must be MATCHED before linking' }, { status: 400 })
    }
    const updated = await prisma.crowdfundingCampaign.update({
      where: { id },
      data: { contractId, status: 'IN_PROGRESS' },
    })
    return NextResponse.json(updated)
  }

  if (action === 'expire') {
    // Mark as expired (auto-refund logic happens on-chain)
    if (campaign.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Only active campaigns can expire' }, { status: 400 })
    }
    const updated = await prisma.crowdfundingCampaign.update({
      where: { id },
      data: { status: 'EXPIRED' },
    })
    return NextResponse.json(updated)
  }

  if (action === 'complete') {
    const updated = await prisma.crowdfundingCampaign.update({
      where: { id },
      data: { status: 'COMPLETED' },
    })
    return NextResponse.json(updated)
  }

  if (action === 'set_onchain') {
    if (!onChainPubkey) {
      return NextResponse.json({ error: 'Missing onChainPubkey' }, { status: 400 })
    }
    const updated = await prisma.crowdfundingCampaign.update({
      where: { id },
      data: { onChainPubkey },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
