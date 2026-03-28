import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/suggestions — list suggestions with filters
export async function GET(req: NextRequest) {
  const district = req.nextUrl.searchParams.get('district')
  const status = req.nextUrl.searchParams.get('status')

  const suggestions = await prisma.citizenSuggestion.findMany({
    where: {
      ...(district && { district }),
      ...(status && { status: status as any }),
    },
    include: {
      citizen: { select: { id: true, walletAddress: true, tier: true, reputationScore: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(suggestions)
}

// POST /api/suggestions — submit a citizen suggestion (Tier 1+ only)
export async function POST(req: NextRequest) {
  const body = await req.json()

  const citizen = await prisma.citizen.findUnique({
    where: { id: body.citizenId },
  })
  if (!citizen) {
    return NextResponse.json({ error: 'Citizen not found' }, { status: 404 })
  }
  if (citizen.reputationScore < 50) {
    return NextResponse.json({ error: 'Minimum Tier 1 (rep >= 50) required' }, { status: 403 })
  }

  // Upvotes needed based on tier
  let upvotesNeeded = 10
  if (citizen.tier === 'TRUSTED') upvotesNeeded = 5
  if (citizen.tier === 'GUARDIAN') upvotesNeeded = 0

  const suggestion = await prisma.citizenSuggestion.create({
    data: {
      citizenId: citizen.id,
      title: body.title,
      problemDesc: body.problemDesc,
      suggestedFix: body.suggestedFix,
      district: body.district,
      lat: body.lat,
      lng: body.lng,
      urgency: body.urgency || 'MEDIUM',
      budgetMin: body.budgetMin ? BigInt(body.budgetMin) : null,
      budgetMax: body.budgetMax ? BigInt(body.budgetMax) : null,
      affectedCount: body.affectedCount,
      photoHashes: body.photoHashes,
      upvotesNeeded,
      status: upvotesNeeded === 0 ? 'AI_RESEARCH' : 'PENDING_UPVOTES',
    },
  })

  return NextResponse.json(suggestion, { status: 201 })
}
