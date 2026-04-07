'use client'

import { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import type { TokenTransaction } from '@/lib/tokens'

/**
 * Listens for straita-token-award events and mirrors each award
 * as a real on-chain SPL mint to the connected wallet.
 *
 * Mount once at the layout level — no changes needed in individual components.
 * Silently no-ops when wallet is disconnected or ADL is not configured.
 */
export function useAdlOnChain() {
  const { publicKey } = useWallet()

  useEffect(() => {
    if (!publicKey) return

    const walletAddress = publicKey.toBase58()

    async function handleAward(e: Event) {
      const tx = (e as CustomEvent<TokenTransaction>).detail
      try {
        await fetch('/api/tokens/award', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: tx.action, walletAddress }),
        })
      } catch {
        // Non-fatal: localStorage already updated, on-chain is best-effort
      }
    }

    window.addEventListener('straita-token-award', handleAward)
    return () => window.removeEventListener('straita-token-award', handleAward)
  }, [publicKey])
}
