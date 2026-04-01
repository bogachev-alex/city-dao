import { prisma } from '@/lib/prisma'

const GAME_STATE_ID = 'singleton'

export async function getGameDay(): Promise<number> {
  const row = await prisma.gameState.findUnique({ where: { id: GAME_STATE_ID } })
  return row?.gameDay ?? 0
}
