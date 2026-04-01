'use client'

/**
 * Dual-mode data source: "mock" uses DEMO_CONTRACTS/DEMO_TRANSACTIONS,
 * "onchain" reads from Solana devnet via Anchor programs.
 *
 * Controlled by NEXT_PUBLIC_DATA_SOURCE env var.
 * Default: "mock" (works without wallet for Colosseum demo).
 */

export type DataSource = 'mock' | 'onchain'

export function useDataSource(): DataSource {
  const raw = process.env.NEXT_PUBLIC_DATA_SOURCE
  if (raw === 'onchain') return 'onchain'
  return 'mock'
}

/** Server-side helper (API routes, RSC) */
export function getDataSource(): DataSource {
  const raw = process.env.NEXT_PUBLIC_DATA_SOURCE
  if (raw === 'onchain') return 'onchain'
  return 'mock'
}
