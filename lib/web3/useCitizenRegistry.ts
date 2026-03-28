'use client'

import { useCallback, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { PROGRAM_IDS, SEEDS } from './constants'
import idl from './idl/citizen_registry.json'

export function useCitizenRegistry() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const msg = err?.message || 'Registration failed'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, getCitizenPDA])

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
