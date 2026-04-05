import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * Rent lifecycle planner endpoint.
 * Lists account types eligible for close and target destination for reclaimed SOL.
 */
export async function GET() {
  return NextResponse.json({
    policy: {
      retentionDays: 90,
      closeOrder: ['jury_vote', 'jury_session', 'temporary_milestone_review'],
      reclaimDestination: 'relayer_reserve_or_district_ops_wallet',
    },
  })
}

export async function POST(req: NextRequest) {
  const denied = requireRole(req, ['AKIMAT'])
  if (denied) return denied
  const body = (await req.json().catch(() => ({}))) as {
    accountType?: string
    accountPubkey?: string
    destination?: string
  }
  if (!body.accountType || !body.accountPubkey || !body.destination) {
    return NextResponse.json(
      { error: 'accountType, accountPubkey, destination required' },
      { status: 400 }
    )
  }
  return NextResponse.json({ queued: true, ...body })
}

