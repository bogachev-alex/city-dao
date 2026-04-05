/**
 * Server-side ADL token utilities.
 * Requires env vars:
 *   NEXT_PUBLIC_ADL_MINT              — mint address (base58)
 *   ADL_MINT_AUTHORITY_SECRET_KEY     — base64-encoded 64-byte keypair secret
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token'
import { SOLANA_RPC_URL } from '@/lib/web3/constants'

export const ADL_DECIMALS = 0

function getAdlMint(): PublicKey {
  const addr = process.env.NEXT_PUBLIC_ADL_MINT
  if (!addr) throw new Error('NEXT_PUBLIC_ADL_MINT is not set')
  return new PublicKey(addr)
}

function getMintAuthority(): Keypair {
  const secret = process.env.ADL_MINT_AUTHORITY_SECRET_KEY
  if (!secret) throw new Error('ADL_MINT_AUTHORITY_SECRET_KEY is not set')
  return Keypair.fromSecretKey(Buffer.from(secret, 'base64'))
}

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, 'confirmed')
}

/**
 * Mint `amount` ADL tokens to the given wallet address.
 * Creates the Associated Token Account if it doesn't exist yet
 * (mint authority pays the rent).
 * Returns the transaction signature.
 */
export async function mintAdlTo(walletAddress: string, amount: number): Promise<string> {
  const connection = getConnection()
  const mint = getAdlMint()
  const authority = getMintAuthority()
  const owner = new PublicKey(walletAddress)

  // Get or create ATA (mint authority pays rent if new)
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,   // payer
    mint,
    owner,
  )

  const sig = await mintTo(
    connection,
    authority,               // payer
    mint,
    tokenAccount.address,    // destination
    authority,               // mint authority
    amount,
  )

  return sig
}

/**
 * Get the on-chain ADL balance for a wallet address.
 * Returns 0 if the token account doesn't exist yet.
 */
export async function getAdlBalance(walletAddress: string): Promise<number> {
  const connection = getConnection()
  const mint = getAdlMint()
  const owner = new PublicKey(walletAddress)

  try {
    const ata = await getAssociatedTokenAddress(mint, owner)
    const account = await getAccount(connection, ata)
    return Number(account.amount)
  } catch (e) {
    if (
      e instanceof TokenAccountNotFoundError ||
      e instanceof TokenInvalidAccountOwnerError
    ) {
      return 0
    }
    throw e
  }
}

/** True when both env vars are set (token is configured). */
export function isAdlConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_ADL_MINT && process.env.ADL_MINT_AUTHORITY_SECRET_KEY)
}
