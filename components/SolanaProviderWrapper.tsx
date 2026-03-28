'use client'

import { ReactNode } from 'react'
import { SolanaProvider } from '../lib/web3/provider'

export function SolanaProviderWrapper({ children }: { children: ReactNode }) {
  return <SolanaProvider>{children}</SolanaProvider>
}
