import { NextResponse } from 'next/server'
import { GAME_STATE_ID, runGameTick } from '@/lib/tick-engine'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Current simulation clock (read-only). */
export async function GET() {
  const state = await prisma.gameState.findUnique({ where: { id: GAME_STATE_ID } })
  return NextResponse.json(
    state ?? { id: GAME_STATE_ID, gameDay: 0, isPaused: false, message: 'No row yet — POST /api/game/tick to init' }
  )
}

/** Advance one game day (tick engine). */
export async function POST() {
  const result = await runGameTick(prisma)
  if (result.paused) {
    return NextResponse.json({ error: 'Game is paused', gameDay: result.gameDay }, { status: 423 })
  }
  return NextResponse.json({
    gameDay: result.gameDay,
    events: result.events,
  })
}
