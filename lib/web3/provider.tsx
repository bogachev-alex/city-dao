'use client'

import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
  CoinbaseWalletAdapter,
  TorusWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { SOLANA_RPC_URL } from './constants'

interface Props {
  children: ReactNode
}

// Type workaround: wallet-adapter types compiled against React 19, project uses React 18
const ConnProvider = ConnectionProvider as any
const WalletProv = WalletProvider as any
const ModalProvider = WalletModalProvider as any

export const SolanaProvider: FC<Props> = ({ children }) => {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TorusWalletAdapter(),
      new TrustWalletAdapter(),
    ],
    []
  )

  return (
    <ConnProvider endpoint={SOLANA_RPC_URL}>
      <WalletProv wallets={wallets} autoConnect={true}>
        <ModalProvider>
          {children}
        </ModalProvider>
      </WalletProv>
    </ConnProvider>
  )
}
