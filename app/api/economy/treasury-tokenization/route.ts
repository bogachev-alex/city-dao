import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * Treasury tokenization control-plane endpoint.
 * Keeps migration state for district treasury USDC vault rollout.
 */
export async function GET() {
  return NextResponse.json({
    mode: 'usdc_rollout',
    steps: [
      'create district treasury token vault PDA',
      'set mint invariant to USDC',
      'route penalties to token vault',
      'execute proposals using token transfers',
    ],
  })
}

export async function POST(req: NextRequest) {
  const denied = requireRole(req, ['AKIMAT'])
  if (denied) return denied
  const body = (await req.json().catch(() => ({}))) as {
    district?: string
    treasuryPda?: string
    treasuryTokenVault?: string
    usdcMint?: string
  }
  if (!body.district || !body.treasuryPda || !body.treasuryTokenVault || !body.usdcMint) {
    return NextResponse.json(
      { error: 'district, treasuryPda, treasuryTokenVault, usdcMint required' },
      { status: 400 }
    )
  }
  return NextResponse.json({ accepted: true, payload: body })
}

