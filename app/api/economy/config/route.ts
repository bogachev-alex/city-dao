import { NextResponse } from 'next/server'
import { USDC_MINT, SOLANA_NETWORK } from '@/lib/web3/constants'
import { USDC_DECIMALS } from '@/lib/economy/usdc'

export const dynamic = 'force-dynamic'

// Public read endpoint for frontend/e2e to align settlement token assumptions.
export async function GET() {
  return NextResponse.json({
    network: SOLANA_NETWORK,
    settlementToken: {
      symbol: 'USDC',
      mint: USDC_MINT.toBase58(),
      decimals: USDC_DECIMALS,
    },
    gasToken: 'SOL',
  })
}

