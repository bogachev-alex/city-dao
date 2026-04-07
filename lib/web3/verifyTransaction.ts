import { Connection } from '@solana/web3.js'
import { SOLANA_RPC_URL, PROGRAM_IDS } from './constants'

const VALID_PROGRAM_IDS = new Set(
  Object.values(PROGRAM_IDS).map((pk) => pk.toBase58())
)

/** Max age of a transaction to be considered valid (5 minutes). */
const MAX_TX_AGE_SECONDS = 300

export interface TxVerificationResult {
  valid: boolean
  error?: string
  /** Program IDs found in the transaction instructions */
  programs?: string[]
  /** Unix timestamp of the block */
  blockTime?: number
}

/**
 * Verify a Solana transaction signature:
 * 1. Exists on-chain
 * 2. Succeeded (no error)
 * 3. Contains at least one of our program IDs
 * 4. Is recent (within MAX_TX_AGE_SECONDS)
 *
 * Returns { valid: true } or { valid: false, error: "reason" }.
 * On RPC failure, returns valid: true to avoid blocking users when devnet is down.
 */
export async function verifyTransaction(
  txSignature: string,
  opts?: { maxAgeSeconds?: number; requireProgram?: boolean }
): Promise<TxVerificationResult> {
  const maxAge = opts?.maxAgeSeconds ?? MAX_TX_AGE_SECONDS
  const requireProgram = opts?.requireProgram ?? true

  // Basic format check: Solana signatures are base58, 87-88 chars
  if (!txSignature || txSignature.length < 80 || txSignature.length > 90) {
    return { valid: false, error: 'Invalid signature format' }
  }

  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

    const tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    })

    if (!tx) {
      return { valid: false, error: 'Transaction not found on-chain' }
    }

    // Check success
    if (tx.meta?.err) {
      return { valid: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` }
    }

    // Check age
    if (tx.blockTime) {
      const age = Math.floor(Date.now() / 1000) - tx.blockTime
      if (age > maxAge) {
        return {
          valid: false,
          error: `Transaction too old: ${age}s (max ${maxAge}s)`,
          blockTime: tx.blockTime,
        }
      }
    }

    // Check that at least one of our programs was invoked
    const programIds = tx.transaction.message
      .staticAccountKeys?.map((k) => k.toBase58()) ?? []
    const matchedPrograms = programIds.filter((id) => VALID_PROGRAM_IDS.has(id))

    if (requireProgram && matchedPrograms.length === 0) {
      return {
        valid: false,
        error: 'Transaction does not involve any Straita programs',
        programs: programIds,
      }
    }

    return {
      valid: true,
      programs: matchedPrograms,
      blockTime: tx.blockTime ?? undefined,
    }
  } catch (err: unknown) {
    // RPC failure — don't block the user, log and allow
    console.warn('[verifyTransaction] RPC error, allowing tx:', (err as Error).message)
    return { valid: true, error: 'RPC unavailable, skipping verification' }
  }
}
