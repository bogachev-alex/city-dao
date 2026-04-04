'use client'

import { useAdlOnChain } from '@/hooks/useAdlOnChain'

/** Mounts the on-chain ADL minting bridge. No visible output. */
export default function AdlOnChainBridge() {
  useAdlOnChain()
  return null
}
