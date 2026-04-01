import { PublicKey } from '@solana/web3.js'
import { USDC_MINT } from '@/lib/web3/constants'

/** USDC uses 6 decimals on Solana. */
export const USDC_DECIMALS = 6
export const USDC_BASE_UNITS = 10 ** USDC_DECIMALS

export function toUsdcBaseUnits(amount: number): bigint {
  return BigInt(Math.round(amount * USDC_BASE_UNITS))
}

export function fromUsdcBaseUnits(amount: bigint | number): number {
  const n = typeof amount === 'bigint' ? Number(amount) : amount
  return n / USDC_BASE_UNITS
}

export function getUsdcMint(): PublicKey {
  return USDC_MINT
}

