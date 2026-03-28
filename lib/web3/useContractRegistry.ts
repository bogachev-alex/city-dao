'use client'

import { useCallback, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { PROGRAM_IDS } from './constants'
import { getContractPDA, getEscrowPDA } from './pda'
import idl from './idl/contract_registry.json'

interface MilestoneInput {
  description: string
  deadlineDays: number
  tranchePct: number
}

export function useContractRegistry() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getProgram = useCallback(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    return new Program(idl as any, provider)
  }, [connection, wallet])

  const fetchContract = useCallback(async (authority: PublicKey, title: string) => {
    const program = getProgram()
    if (!program) return null

    const [pda] = getContractPDA(authority, title)
    try {
      const account = await (program.account as any).governmentContract.fetch(pda)
      return account
    } catch {
      return null
    }
  }, [getProgram])

  const registerContract = useCallback(async (
    title: string,
    district: string,
    totalAmount: number,
    deadline: number,
    milestones: MilestoneInput[],
    lat: number,
    lng: number,
    contractorPubkey: PublicKey
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [contractPDA] = getContractPDA(wallet.publicKey, title)
      const [escrowPDA] = getEscrowPDA(contractPDA)

      const milestoneInputs = milestones.map((m) => ({
        description: m.description,
        deadlineDays: m.deadlineDays,
        tranchePct: m.tranchePct,
      }))

      const tx = await (program.methods as any)
        .registerContract(
          title,
          district,
          new BN(totalAmount),
          new BN(deadline),
          milestoneInputs,
          lat,
          lng
        )
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractorPubkey,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Contract registered on-chain:', tx)
      return { tx, pda: contractPDA.toBase58() }
    } catch (err: any) {
      const msg = err?.message || 'Contract registration failed'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram])

  return {
    registerContract,
    fetchContract,
    loading,
    error,
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
  }
}
