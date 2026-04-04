import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cronAuth'
import { diagnoseCrowdfundingRefundKeeper } from '@/lib/crowdfundingAutoRefund'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/crowdfunding-refund-diagnostics
 * Same auth as refund cron: Authorization: Bearer CRON_SECRET or x-cron-secret.
 * Verifies keeper secret parses, shows keeper pubkey + balance, RPC, DB queue count — no refunds executed.
 */
export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const diagnostics = await diagnoseCrowdfundingRefundKeeper()

  const healthy =
    diagnostics.cronSecretConfigured &&
    diagnostics.keeperSecretConfigured &&
    diagnostics.keeperKeypairValid &&
    diagnostics.rpcReachable &&
    diagnostics.keeperPublicKey != null &&
    (diagnostics.keeperBalanceLamports ?? 0) > 0

  return NextResponse.json({
    ok: healthy,
    ...diagnostics,
    notes: [
      'keeperBalanceLamports must be > 0 to pay Solana tx fees for refund_all',
      'dbExpiredActiveWithPubkeyCount is campaigns in DB past deadline still ACTIVE with onChainPubkey (actual refund may skip: legacy vault, target met on-chain, etc.)',
      'Run GET /api/cron/crowdfunding-refunds with same auth to execute refunds',
    ],
  })
}
