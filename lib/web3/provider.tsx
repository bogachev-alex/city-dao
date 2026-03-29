'use client'

import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { SOLANA_RPC_URL } from './constants'
import { DemoKeypairAdapter } from './DemoKeypairAdapter'
import { DemoWalletAutoConnect } from '@/components/DemoWalletAutoConnect'
import { DemoWalletBanner } from '@/components/DemoWalletBanner'
import { DemoCitizenAutoRegister } from '@/components/DemoCitizenAutoRegister'

import '@solana/wallet-adapter-react-ui/styles.css'

interface Props {
  children: ReactNode
}

// Type workaround: wallet-adapter types compiled against React 19, project uses React 18
const ConnProvider = ConnectionProvider as any
const WalletProv = WalletProvider as any
const ModalProv = WalletModalProvider as any

export const SolanaProvider: FC<Props> = ({ children }) => {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // Demo wallet: auto-funded devnet keypair, no extension needed
      new DemoKeypairAdapter(),
    ],
    []
  )

  return (
    <ConnProvider endpoint={SOLANA_RPC_URL}>
      {/* autoConnect=false so DemoWalletAutoConnect controls the flow */}
      <WalletProv wallets={wallets} autoConnect={false}>
        <ModalProv>
          {/* Auto-selects demo wallet when no Phantom, user is logged in */}
          <DemoWalletAutoConnect />
          {/* Auto-creates a Citizen DB record so citizen-gated pages work */}
          <DemoCitizenAutoRegister />
          {/* Floating banner with balance + airdrop button */}
          <DemoWalletBanner />
          {children}
        </ModalProv>
      </WalletProv>
    </ConnProvider>
  )
}
