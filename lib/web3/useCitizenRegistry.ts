'use client'

import { useCallback, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { PROGRAM_IDS, SEEDS, SOLANA_NETWORK } from './constants'
import idl from './idl/citizen_registry.json'

export function useCitizenRegistry() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toReadableError = useCallback((err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err || '')
    if (raw.includes('Attempt to debit an account but found no record of a prior credit')) {
      return `Wallet has no SOL on ${SOLANA_NETWORK}. Fund your wallet and retry.`
    }
    return raw || 'Registration failed'
  }, [])

  const getProgram = useCallback(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    return new Program(idl as any, provider)
  }, [connection, wallet])

  // Derive citizen PDA
  const getCitizenPDA = useCallback((walletKey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [SEEDS.citizen, walletKey.toBuffer()],
      PROGRAM_IDS.citizenRegistry
    )
  }, [])

  // Check if citizen exists on-chain
  const fetchCitizenProfile = useCallback(async () => {
    if (!wallet.publicKey) return null
    const program = getProgram()
    if (!program) return null

    const [pda] = getCitizenPDA(wallet.publicKey)
    try {
      const account = await (program.account as any).citizenProfile.fetch(pda)
      return account
    } catch {
      return null // Account doesn't exist
    }
  }, [wallet.publicKey, getProgram, getCitizenPDA])

  // Register citizen on-chain
  const registerCitizen = useCallback(async (district: string, iinHash: Uint8Array) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [citizenPDA] = getCitizenPDA(wallet.publicKey)

      // Convert iinHash hex string to [u8; 32] array
      const hashArray = Array.from(iinHash)

      const tx = await (program.methods as any)
        .registerCitizen(district, hashArray)
        .accounts({
          citizenProfile: citizenPDA,
          wallet: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Citizen registered on-chain:', tx)
      return { tx, pda: citizenPDA.toBase58() }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, getCitizenPDA, toReadableError])

  return {
    registerCitizen,
    fetchCitizenProfile,
    getCitizenPDA,
    loading,
    error,
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
  }
}
