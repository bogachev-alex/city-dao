import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGameDay } from '@/lib/agent/game-day'

export const dynamic = 'force-dynamic'

// POST /api/satisfaction — citizen rates district satisfaction 1–5 (once per game day)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const citizenId = String(body.citizenId || '')
  const score = Number(body.score)

  if (!citizenId) {
    return NextResponse.json({ error: 'citizenId required' }, { status: 400 })
  }
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: 'score must be 1-5' }, { status: 400 })
  }

  const citizen = await prisma.citizen.findUnique({ where: { id: citizenId } })
  if (!citizen) {
    return NextResponse.json({ error: 'Citizen not found' }, { status: 404 })
  }

  const gameDay = await getGameDay()

  try {
    const vote = await prisma.satisfactionVote.create({
      data: {
        citizenId,
        gameDay,
        score: Math.floor(score),
        district: citizen.district,
      },
    })
    return NextResponse.json({ vote }, { status: 201 })
  } catch (err: any) {
    const msg = String(err?.message || '')
    if (msg.includes('Unique constraint') || msg.includes('@@unique') || msg.includes('P2002')) {
      return NextResponse.json(
        { error: 'Already rated satisfaction today' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 })
  }
}

