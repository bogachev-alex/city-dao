import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * Placeholder API for expert staking/slashing orchestration.
 * The actual fund movement is expected on-chain (stake vault + slash instruction).
 */
export async function POST(req: NextRequest) {
  const denied = requireRole(req, ['AKIMAT'])
  if (denied) return denied
  const body = (await req.json().catch(() => ({}))) as {
    action?: 'stake' | 'slash'
    expertWallet?: string
    amountBaseUnits?: string
    district?: string
    reasonCode?: string
  }
  if (!body.action || !body.expertWallet || !body.amountBaseUnits) {
    return NextResponse.json({ error: 'action, expertWallet, amountBaseUnits required' }, { status: 400 })
  }
  return NextResponse.json({
    accepted: true,
    next: 'execute on-chain instruction',
    payload: body,
  })
}

