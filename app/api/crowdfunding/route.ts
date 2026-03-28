import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// State matching percentages by category
const STATE_PERCENT: Record<string, number> = {
  PLAYGROUND: 90,
  SCHOOL: 90,
  ROADS: 70,
  LANDSCAPING: 50,
  COMMERCIAL: 0,
}

// GET /api/crowdfunding — list campaigns with optional filters
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const district = searchParams.get('district')
  const status = searchParams.get('status')
  const category = searchParams.get('category')

  const campaigns = await prisma.crowdfundingCampaign.findMany({
    where: {
      ...(district && { district }),
      ...(status && { status: status as any }),
      ...(category && { category: category as any }),
    },
    include: {
      creator: { select: { id: true, walletAddress: true, district: true, tier: true, reputationScore: true } },
      contributions: {
        select: { id: true, citizenId: true, amount: true, anonymous: true, createdAt: true, citizen: { select: { walletAddress: true, district: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      _count: { select: { contributions: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(campaigns)
}

// POST /api/crowdfunding — create a new campaign
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, district, category, targetAmount, deadline, creatorId, lat, lng, onChainPubkey } = body

  // Validate
  if (!title || !description || !district || !category || !targetAmount || !deadline || !creatorId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const total = BigInt(targetAmount)
  const statePercent = STATE_PERCENT[category] ?? 0
  const citizenTarget = total * BigInt(100 - statePercent) / BigInt(100)
  const stateMatch = total - citizenTarget

  const campaign = await prisma.crowdfundingCampaign.create({
    data: {
      title,
      description,
      district,
      lat: lat || 43.25,
      lng: lng || 76.91,
      category,
      targetAmount: total,
      citizenTarget,
      stateMatch,
      deadline: new Date(deadline),
      creatorId,
      onChainPubkey: onChainPubkey || null,
    },
    include: {
      creator: { select: { id: true, walletAddress: true, tier: true } },
    },
  })

  return NextResponse.json(campaign, { status: 201 })
}
