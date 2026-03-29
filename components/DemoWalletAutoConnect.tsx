'use client'

/**
 * Invisible component that auto-selects the demo wallet when:
 *  - user is logged in via demo auth (AuthContext)
 *  - no real wallet (Phantom / Solflare) is connected
 *
 * Must be rendered inside both <AuthProvider> and <WalletProvider>.
 */

import { useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAuth } from './AuthContext'
import { DemoWalletName } from '@/lib/web3/DemoKeypairAdapter'

export function DemoWalletAutoConnect() {
  const { user } = useAuth()
  const { connected, connecting, wallet, wallets, select, connect } = useWallet()
  const connectAttempted = useRef(false)

  useEffect(() => {
    // Only auto-connect if:
    //  1. user is logged in
    //  2. no wallet connected/connecting yet
    //  3. haven't already tried
    if (!user) return
    if (connected || connecting) return
    if (connectAttempted.current) return

    // If Phantom/Solflare is already selected (returning user), let it connect normally
    if (wallet && wallet.adapter.name !== DemoWalletName) return

    const demoAdapter = wallets.find((w) => w.adapter.name === DemoWalletName)
    if (!demoAdapter) return

    connectAttempted.current = true
    select(DemoWalletName)
  }, [user, connected, connecting, wallet, wallets, select])

  // After select() → connect()
  useEffect(() => {
    if (!user) return
    if (connected || connecting) return
    if (!wallet || wallet.adapter.name !== DemoWalletName) return

    connect().catch(() => {
      connectAttempted.current = false // allow retry
    })
  }, [user, wallet, connected, connecting, connect])

  return null
}
