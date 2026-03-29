import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { SOLANA_RPC_URL } from '@/lib/web3/constants'

export const dynamic = 'force-dynamic'

const MIN_BALANCE = 0.5 * LAMPORTS_PER_SOL
const AIRDROP_AMOUNT = 2 * LAMPORTS_PER_SOL

/**
 * POST /api/solana/airdrop
 * Body: { address: string }
 *
 * Requests 2 devnet SOL for the given address.
 * Skips if balance is already ≥ 0.5 SOL.
 * Called automatically by the demo wallet banner on first connect.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { address } = body as { address?: string }

  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 })
  }

  let pubkey: PublicKey
  try {
    pubkey = new PublicKey(address)
  } catch {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

  try {
    const balance = await connection.getBalance(pubkey)

    if (balance >= MIN_BALANCE) {
      return NextResponse.json({
        skipped: true,
        balance: balance / LAMPORTS_PER_SOL,
        message: 'Balance already sufficient',
      })
    }

    const sig = await connection.requestAirdrop(pubkey, AIRDROP_AMOUNT)
    // Don't await confirmation — devnet can be slow; client polls balance
    return NextResponse.json({
      signature: sig,
      requested: AIRDROP_AMOUNT / LAMPORTS_PER_SOL,
      explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
    })
  } catch (err: any) {
    const msg: string = err?.message ?? String(err)
    // Devnet faucet rate-limits are common — surface a friendly message
    const isRateLimit =
      msg.includes('airdrop limit') ||
      msg.includes('rate') ||
      msg.includes('429')
    return NextResponse.json(
      {
        error: isRateLimit
          ? 'Лимит faucet превышен. Повторите через минуту или получите SOL на https://faucet.solana.com'
          : msg,
      },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
