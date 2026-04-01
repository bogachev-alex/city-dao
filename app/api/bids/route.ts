import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openBidRound, submitBid } from '@/lib/bidding'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const contractId = req.nextUrl.searchParams.get('contractId')
  const status = req.nextUrl.searchParams.get('status')

  const rounds = await prisma.bidRound.findMany({
    where: {
      ...(contractId && { contractId }),
      ...(status && { status: status as 'OPEN' | 'CLOSED' | 'AWARDED' }),
    },
    include: {
      contract: { select: { id: true, title: true, district: true, totalAmount: true } },
      bids: { include: { contractor: { select: { id: true, name: true, rating: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(rounds)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === 'openRound') {
    if (!body.contractId) {
      return NextResponse.json({ error: 'contractId required' }, { status: 400 })
    }
    try {
      const r = await openBidRound(body.contractId, body.openedDay)
      return NextResponse.json(r, { status: 201 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  if (body.action === 'submitBid') {
    if (!body.bidRoundId || !body.contractorId || body.amount == null || body.daysToComplete == null) {
      return NextResponse.json(
        { error: 'bidRoundId, contractorId, amount, daysToComplete required' },
        { status: 400 }
      )
    }
    try {
      const b = await submitBid({
        bidRoundId: body.bidRoundId,
        contractorId: body.contractorId,
        amount: BigInt(body.amount),
        daysToComplete: Number(body.daysToComplete),
        qualityPledge: body.qualityPledge,
      })
      return NextResponse.json(b, { status: 201 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  return NextResponse.json({ error: 'Use action openRound or submitBid' }, { status: 400 })
}
