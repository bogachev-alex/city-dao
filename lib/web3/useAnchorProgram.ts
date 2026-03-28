'use client'

import { useMemo } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor'
import { PROGRAM_IDS } from './constants'

export function useAnchorProvider() {
  const { connection } = useConnection()
  const wallet = useWallet()

  return useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null
    return new AnchorProvider(connection, wallet as any, {
      commitment: 'confirmed',
    })
  }, [connection, wallet])
}

export function useProgram<T extends Idl>(idl: T, programId: keyof typeof PROGRAM_IDS) {
  const provider = useAnchorProvider()

  return useMemo(() => {
    if (!provider) return null
    return new Program(idl as any, provider)
  }, [provider, idl])
}
