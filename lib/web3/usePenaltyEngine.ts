'use client'

import { useCallback, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor'
import { PROGRAM_IDS, SEEDS, SOLANA_NETWORK } from './constants'
import { getTreasuryPDA } from './pda'
import idl from './idl/penalty_engine.json'

export type PenaltyType = 'timeOverdue' | 'qualityRejected' | 'ghostSite'

const PENALTY_TYPE_MAP: Record<PenaltyType, object> = {
  timeOverdue: { timeOverdue: {} },
  qualityRejected: { qualityRejected: {} },
  ghostSite: { ghostSite: {} },
}

export function usePenaltyEngine() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toReadableError = useCallback((err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err || '')
    if (raw.includes('Attempt to load a program that does not exist')) {
      return `Penalty engine is not deployed on ${PROGRAM_IDS.penaltyEngine.toBase58()} in ${SOLANA_NETWORK}.`
    }
    return raw || 'Penalty operation failed'
  }, [])

  const getProgram = useCallback(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    return new Program(idl as any, provider)
  }, [connection, wallet])

  // Derive penalty record PDA from contract pubkey + nonce
  const getPenaltyRecordPDA = useCallback((contractPubkey: PublicKey, nonce: number) => {
    const nonceBuf = Buffer.alloc(8)
    nonceBuf.writeBigUInt64LE(BigInt(nonce))
    return PublicKey.findProgramAddressSync(
      [SEEDS.penalty, contractPubkey.toBuffer(), nonceBuf],
      PROGRAM_IDS.penaltyEngine
    )
  }, [])

  /**
   * Execute a penalty against a contract.
   *
   * @param contractDataPubkey - The GovernmentContract PDA from contract_registry
   * @param district           - District name (used to derive treasury PDA)
   * @param nonce              - Incrementing nonce to allow multiple penalties per contract
   * @param penaltyType        - 'timeOverdue' | 'qualityRejected' | 'ghostSite'
   * @param daysOverdue        - Number of days past deadline (0 if not time-based)
   * @param rejectionCount     - Number of milestone rejections
   * @param ghostCount         - Number of ghost site visits (no work visible)
   */
  const executePenalty = useCallback(async (
    contractDataPubkey: PublicKey,
    district: string,
    nonce: number,
    penaltyType: PenaltyType,
    daysOverdue: number,
    rejectionCount: number,
    ghostCount: number,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [penaltyRecordPDA] = getPenaltyRecordPDA(contractDataPubkey, nonce)
      const [districtTreasuryPDA] = getTreasuryPDA(district)

      const tx = await (program.methods as any)
        .executePenalty(
          new BN(nonce),
          PENALTY_TYPE_MAP[penaltyType],
          new BN(daysOverdue),
          rejectionCount,
          ghostCount,
        )
        .accounts({
          contractData: contractDataPubkey,
          penaltyRecord: penaltyRecordPDA,
          districtTreasury: districtTreasuryPDA,
          caller: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Penalty executed on-chain:', tx)
      return { tx, penaltyRecord: penaltyRecordPDA.toBase58() }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, getPenaltyRecordPDA, toReadableError])

  return {
    executePenalty,
    getPenaltyRecordPDA,
    loading,
    error,
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
  }
}
