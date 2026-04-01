import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { awardBidRound, closeBidRound } from '@/lib/bidding'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params
  const round = await prisma.bidRound.findUnique({
    where: { id: roundId },
    include: {
      contract: { select: { id: true, title: true, district: true, totalAmount: true } },
      bids: { include: { contractor: { select: { id: true, name: true, rating: true, reputationScore: true } } } },
      winner: { select: { id: true, name: true } },
    },
  })
  if (!round) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(round)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params
  const body = await req.json()

  try {
    if (body.action === 'close') {
      const r = await closeBidRound(roundId)
      return NextResponse.json(r)
    }
    if (body.action === 'award') {
      const r = await awardBidRound(roundId, body.winnerContractorId)
      return NextResponse.json(r)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ error: 'Use action close or award' }, { status: 400 })
}
