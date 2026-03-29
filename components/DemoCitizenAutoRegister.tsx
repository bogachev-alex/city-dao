'use client'

/**
 * Automatically creates a Citizen DB record when the demo wallet connects
 * for the first time. This makes all citizen-gated features (crowdfunding,
 * jury voting, etc.) work in demo mode without manual IIN registration.
 *
 * Idempotent: if the citizen already exists the POST returns 409 which we
 * silently ignore.
 */

import { useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAuth } from './AuthContext'
import { DISTRICTS } from '@/lib/contracts'

const DISTRICTS_LIST = [...DISTRICTS]

// Pick a deterministic district for demo citizen based on wallet address
function pickDistrict(addr: string): string {
  const idx = addr.charCodeAt(0) % DISTRICTS_LIST.length
  return DISTRICTS_LIST[idx]
}

// Demo IIN hash — unique per wallet, never a real IIN
async function demoCitizenHash(addr: string): Promise<string> {
  const data = new TextEncoder().encode(`demo:${addr}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function DemoCitizenAutoRegister() {
  const { user } = useAuth()
  const { publicKey, connected } = useWallet()
  const registered = useRef(false)

  useEffect(() => {
    // Auto-register citizen for ANY wallet when in demo auth mode.
    // Idempotent: 409 (already exists) is silently ignored.
    if (!user) return
    if (!connected || !publicKey) return
    if (registered.current) return

    registered.current = true
    const addr = publicKey.toBase58()

    demoCitizenHash(addr).then(async (iinHash) => {
      const district = pickDistrict(addr)
      try {
        const res = await fetch('/api/citizens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: addr, district, iinHash }),
        })
        const data = await res.json()
        // 409 = already registered — that's fine
        if (!data.error || res.status === 409) {
          console.log('[DemoWallet] Citizen ready:', addr)
        } else {
          console.warn('[DemoWallet] Citizen registration failed:', data.error)
          registered.current = false // allow retry
        }
      } catch {
        registered.current = false
      }
    })
  }, [user, connected, publicKey, wallet])

  return null
}
