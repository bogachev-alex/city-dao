import { NextRequest, NextResponse } from 'next/server'
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js'
import { SOLANA_RPC_URL, PROGRAM_IDS } from '@/lib/web3/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const RATE = new Map<string, { hits: number; resetAt: number }>()
const WINDOW_MS = 60_000
const LIMIT = 20

function checkLimit(key: string): boolean {
  const now = Date.now()
  const cur = RATE.get(key)
  if (!cur || now > cur.resetAt) {
    RATE.set(key, { hits: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (cur.hits >= LIMIT) return false
  cur.hits += 1
  return true
}

function parseRelayer(): Keypair | null {
  const raw = process.env.RELAYER_SECRET_KEY
  if (!raw) return null
  try {
    const arr = JSON.parse(raw) as number[]
    return Keypair.fromSecretKey(Uint8Array.from(arr))
  } catch {
    return null
  }
}

/**
 * MVP relayer endpoint:
 * - accepts base64 serialized tx from citizen client
 * - validates instruction allowlist (jury + citizen registry only)
 * - sets fee payer to relayer and sends tx
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local'
  if (!checkLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const relayer = parseRelayer()
  if (!relayer) {
    return NextResponse.json({ error: 'Relayer is not configured' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as { txBase64?: string }
  if (!body.txBase64) {
    return NextResponse.json({ error: 'txBase64 required' }, { status: 400 })
  }

  try {
    const tx = VersionedTransaction.deserialize(Buffer.from(body.txBase64, 'base64'))
    const accountKeys = tx.message.getAccountKeys().staticAccountKeys

    const allowedPrograms = new Set([
      PROGRAM_IDS.juryMechanism.toBase58(),
      PROGRAM_IDS.citizenRegistry.toBase58(),
    ])
    const allAllowed = tx.message.compiledInstructions.every((ix) => {
      const pid = accountKeys[ix.programIdIndex]
      return pid ? allowedPrograms.has(pid.toBase58()) : false
    })
    if (!allAllowed) {
      return NextResponse.json({ error: 'Instruction not allowed for relayer' }, { status: 403 })
    }

    // Rebuild tx to set relayer as fee payer while preserving user signatures.
    // For MVP we expect client to compile with fee payer placeholder = relayer pubkey.
    const hasRelayerKey = accountKeys.some((k) => k.equals(relayer.publicKey))
    if (!hasRelayerKey) {
      return NextResponse.json({ error: 'Transaction must include relayer fee payer key' }, { status: 400 })
    }

    tx.sign([relayer])
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
    const sig = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 })
    return NextResponse.json({ signature: sig })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid transaction' },
      { status: 400 }
    )
  }
}

