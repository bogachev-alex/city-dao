'use client'

/**
 * Invisible component that auto-selects the demo wallet ONLY as a fallback:
 *  - user is logged in via demo auth
 *  - Phantom / Solflare is NOT installed or NOT previously connected
 *
 * If Phantom is installed, autoConnect (from WalletProvider) handles it and
 * this component stays out of the way.
 *
 * Must be rendered inside both <AuthProvider> and <WalletProvider>.
 */

import { useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import { useAuth } from './AuthContext'
import { DemoWalletName } from '@/lib/web3/DemoKeypairAdapter'

// How long to wait for Phantom autoConnect before falling back to demo wallet
const PHANTOM_GRACE_MS = 1200

export function DemoWalletAutoConnect() {
  const { user } = useAuth()
  const { connected, connecting, wallet, wallets, select, connect } = useWallet()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectAttempted = useRef(false)

  useEffect(() => {
    if (!user) return
    if (connected || connecting) return   // real wallet already active
    if (selectAttempted.current) return

    // If a real wallet is already selected, let it connect on its own
    if (wallet && wallet.adapter.name !== DemoWalletName) return

    // If Phantom/Solflare is installed, give it time to auto-connect first
    const hasRealWallet = wallets.some(
      (w) =>
        w.adapter.name !== DemoWalletName &&
        w.readyState === WalletReadyState.Installed
    )

    if (hasRealWallet) {
      // Wait for Phantom's autoConnect; only select demo if it doesn't connect
      timerRef.current = setTimeout(() => {
        if (!connected && !connecting) {
          selectAttempted.current = true
          select(DemoWalletName)
        }
      }, PHANTOM_GRACE_MS)
    } else {
      // No real wallet installed → select demo immediately
      selectAttempted.current = true
      select(DemoWalletName)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [user, connected, connecting, wallet, wallets, select])

  // After select(DemoWalletName) → connect()
  useEffect(() => {
    if (!user) return
    if (connected || connecting) return
    if (!wallet || wallet.adapter.name !== DemoWalletName) return

    connect().catch(() => {
      selectAttempted.current = false // allow retry
    })
  }, [user, wallet, connected, connecting, connect])

  return null
}
