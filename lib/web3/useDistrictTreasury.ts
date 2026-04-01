'use client'

import { useCallback, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { PROGRAM_IDS, SEEDS, SOLANA_NETWORK } from './constants'
import idl from './idl/district_treasury.json'

export function useDistrictTreasury() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toReadableError = useCallback((err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err || '')
    if (raw.includes('Attempt to debit an account but found no record of a prior credit')) {
      return `Wallet has no SOL on ${SOLANA_NETWORK}. Fund your wallet and retry.`
    }
    return raw || 'Vote failed'
  }, [])

  const getProgram = useCallback(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    return new Program(idl as any, provider)
  }, [connection, wallet])

  // Derive treasury PDA
  const getTreasuryPDA = useCallback((district: string) => {
    return PublicKey.findProgramAddressSync(
      [SEEDS.treasury, Buffer.from(district)],
      PROGRAM_IDS.districtTreasury
    )
  }, [])

  // Derive proposal PDA by treasury + proposal counter (u32 LE).
  const getProposalPDA = useCallback((treasuryKey: PublicKey, proposalCount: number) => {
    const countBuf = Buffer.alloc(4)
    countBuf.writeUInt32LE(proposalCount)
    return PublicKey.findProgramAddressSync(
      [SEEDS.proposal, treasuryKey.toBuffer(), countBuf],
      PROGRAM_IDS.districtTreasury
    )
  }, [])

  // Derive ballot PDA (prevents duplicate votes)
  const getBallotPDA = useCallback((proposalKey: PublicKey, voterKey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [SEEDS.ballot, proposalKey.toBuffer(), voterKey.toBuffer()],
      PROGRAM_IDS.districtTreasury
    )
  }, [])

  // Vote on a proposal on-chain
  const voteOnProposal = useCallback(async (
    district: string,
    proposalId: string,
    proposalTitle: string,
    inFavor: boolean,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [treasuryPDA] = getTreasuryPDA(district)
      const onChainProposalKey = `offchain:${proposalId}`

      let proposalPDA: PublicKey | null = null

      // 1) Try to find existing on-chain proposal in this treasury by a stable key.
      try {
        const all = await (program.account as any).spendingProposalAccount.all([
          {
            memcmp: {
              offset: 8, // account discriminator (8) + first field starts
              bytes: treasuryPDA.toBase58(),
            },
          },
        ])
        const found = all.find((x: any) => String(x.account?.title || '') === onChainProposalKey)
        if (found?.publicKey) proposalPDA = found.publicKey as PublicKey
      } catch {
        // Ignore scan errors; we'll attempt lazy creation below.
      }

      // 2) If missing, create on-chain proposal lazily before voting.
      if (!proposalPDA) {
        const treasuryAcc = await (program.account as any).districtTreasuryAccount.fetch(treasuryPDA)
        const proposalCount = Number(treasuryAcc?.proposalCount ?? treasuryAcc?.proposal_count ?? 0)
        const [nextProposalPDA] = getProposalPDA(treasuryPDA, proposalCount)

        await (program.methods as any)
          .createProposal(
            onChainProposalKey,
            proposalTitle,
            new BN(0), // allow bootstrap even when treasury balance is zero
            'GENERAL',
          )
          .accounts({
            districtTreasury: treasuryPDA,
            spendingProposal: nextProposalPDA,
            proposer: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc()

        proposalPDA = nextProposalPDA
      }

      if (!proposalPDA) throw new Error('Failed to resolve on-chain spending proposal.')
      const [ballotPDA] = getBallotPDA(proposalPDA, wallet.publicKey)

      const tx = await (program.methods as any)
        .voteOnProposal(inFavor)
        .accounts({
          spendingProposal: proposalPDA,
          voterBallot: ballotPDA,
          voter: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Vote on-chain tx:', tx)
      return { tx }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, getTreasuryPDA, getProposalPDA, getBallotPDA, toReadableError])

  return {
    voteOnProposal,
    getTreasuryPDA,
    loading,
    error,
    connected: !!wallet.publicKey,
  }
}
