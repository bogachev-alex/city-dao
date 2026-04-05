import { NextRequest, NextResponse } from 'next/server'
import { mintAdlTo, isAdlConfigured } from '@/lib/adl-token'
import type { TokenAction } from '@/lib/tokens'

export const dynamic = 'force-dynamic'

const REWARD_TABLE: Record<TokenAction, number> = {
  registration:          100,
  jury_vote:             25,
  jury_reveal:           25,
  crowdfunding_donation: 15,
  treasury_vote:         20,
  contract_report:       30,
  daily_login:           5,
  proposal_created:      50,
}

export async function POST(req: NextRequest) {
  if (!isAdlConfigured()) {
    return NextResponse.json({ error: 'ADL token not configured' }, { status: 503 })
  }

  let body: { action?: string; walletAddress?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, walletAddress } = body

  if (!action || !(action in REWARD_TABLE)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (!walletAddress || typeof walletAddress !== 'string') {
    return NextResponse.json({ error: 'walletAddress required' }, { status: 400 })
  }

  const amount = REWARD_TABLE[action as TokenAction]

  try {
    const signature = await mintAdlTo(walletAddress, amount)
    return NextResponse.json({ ok: true, amount, signature })
  } catch (e) {
    console.error('[ADL award]', e)
    return NextResponse.json({ error: 'Minting failed' }, { status: 500 })
  }
}
