'use client'

import { useCallback, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AccountMeta, PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { PROGRAM_IDS, SEEDS, SOLANA_NETWORK } from './constants'
import idl from './idl/crowdfunding.json'

const MAX_SEED_BYTES = 32

function normalizeSeedString(input: string): string {
  // Solana seed max length is 32 bytes, not 32 chars.
  let out = input
  while (Buffer.byteLength(out, 'utf8') > MAX_SEED_BYTES) {
    out = out.slice(0, -1)
  }
  return out
}

// Category enum matching on-chain representation
const CATEGORY_MAP = {
  playground: { playground: {} },
  school: { school: {} },
  roads: { roads: {} },
  landscaping: { landscaping: {} },
  commercial: { commercial: {} },
} as const

/** Wallet stub for read-only Anchor calls (fetch account data without user signature). */
const READ_ONLY_WALLET = {
  publicKey: PublicKey.default,
  signTransaction: async <T extends { serialize(): Uint8Array }>(tx: T) => tx,
  signAllTransactions: async <T extends { serialize(): Uint8Array }>(txs: T[]) => txs,
}

export function useCrowdfunding() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readOnlyProgram = useMemo(() => {
    const provider = new AnchorProvider(connection, READ_ONLY_WALLET as any, { commitment: 'confirmed' })
    return new Program(idl as any, provider)
  }, [connection])

  const toReadableError = useCallback((err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err || '')
    if (raw.includes('Attempt to load a program that does not exist')) {
      return `Crowdfunding program is not deployed on ${PROGRAM_IDS.crowdfunding.toBase58()} in ${SOLANA_NETWORK}.`
    }
    return raw || 'Crowdfunding operation failed'
  }, [])

  const getProgram = useCallback(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    return new Program(idl as any, provider)
  }, [connection, wallet])

  // Derive campaign PDA
  const getCampaignPDA = useCallback((creator: PublicKey, title: string) => {
    const seedTitle = normalizeSeedString(title)
    return PublicKey.findProgramAddressSync(
      [SEEDS.campaign, creator.toBuffer(), Buffer.from(seedTitle)],
      PROGRAM_IDS.crowdfunding
    )
  }, [])

  // Derive escrow PDA
  const getEscrowPDA = useCallback((campaignKey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [SEEDS.cfEscrow, campaignKey.toBuffer()],
      PROGRAM_IDS.crowdfunding
    )
  }, [])

  // Derive donor record PDA
  const getDonorPDA = useCallback((campaignKey: PublicKey, donorKey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [SEEDS.donor, campaignKey.toBuffer(), donorKey.toBuffer()],
      PROGRAM_IDS.crowdfunding
    )
  }, [])

  // Create a new campaign on-chain
  const createCampaign = useCallback(async (
    title: string,
    description: string,
    district: string,
    category: keyof typeof CATEGORY_MAP,
    targetAmount: number,
    deadline: number, // unix timestamp
    lat: number,
    lng: number,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const onChainTitle = normalizeSeedString(title)
      const [campaignPDA] = getCampaignPDA(wallet.publicKey, onChainTitle)
      const [escrowPDA] = getEscrowPDA(campaignPDA)

      const tx = await (program.methods as any)
        .initCampaign(
          onChainTitle,
          description,
          district,
          CATEGORY_MAP[category],
          new BN(targetAmount),
          new BN(deadline),
          lat,
          lng,
        )
        .accounts({
          campaign: campaignPDA,
          escrow: escrowPDA,
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Campaign created on-chain:', tx)
      return { tx, pda: campaignPDA.toBase58() }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, getCampaignPDA, getEscrowPDA, toReadableError])

  // Contribute to a campaign on-chain
  const contribute = useCallback(async (
    campaignCreator: PublicKey,
    campaignTitle: string,
    amount: number,
    anonymous: boolean,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [campaignPDA] = getCampaignPDA(campaignCreator, campaignTitle)
      const [escrowPDA] = getEscrowPDA(campaignPDA)
      const [donorPDA] = getDonorPDA(campaignPDA, wallet.publicKey)

      const tx = await (program.methods as any)
        .contribute(new BN(amount), anonymous)
        .accounts({
          campaign: campaignPDA,
          escrow: escrowPDA,
          donorRecord: donorPDA,
          donor: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Contribution on-chain:', tx)
      return { tx }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, getCampaignPDA, getEscrowPDA, getDonorPDA, toReadableError])

  /// Akimat deposits state matching (signer must hold `state_match` lamports).
  const matchFunds = useCallback(
    async (campaignCreator: PublicKey, campaignTitle: string) => {
      if (!wallet.publicKey) throw new Error('Wallet not connected')
      const program = getProgram()
      if (!program) throw new Error('Program not initialized')

      setLoading(true)
      setError(null)
      try {
        const [campaignPDA] = getCampaignPDA(campaignCreator, campaignTitle)
        const [escrowPDA] = getEscrowPDA(campaignPDA)
        const tx = await (program.methods as any)
          .matchFunds()
          .accounts({
            campaign: campaignPDA,
            escrow: escrowPDA,
            akimat: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        return { tx }
      } catch (err: any) {
        const msg = err?.message || 'match_funds failed'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [wallet.publicKey, getProgram, getCampaignPDA, getEscrowPDA],
  )

  /**
   * Refund after deadline if citizen target not met.
   * Pass every donor wallet that contributed; builds donor_record + donor pairs as remaining accounts.
   */
  const refundAll = useCallback(
    async (campaignCreator: PublicKey, campaignTitle: string, donorWallets: PublicKey[]) => {
      if (!wallet.publicKey) throw new Error('Wallet not connected')
      const program = getProgram()
      if (!program) throw new Error('Program not initialized')

      setLoading(true)
      setError(null)
      try {
        const [campaignPDA] = getCampaignPDA(campaignCreator, campaignTitle)
        const [escrowPDA] = getEscrowPDA(campaignPDA)

        const remainingAccounts: AccountMeta[] = donorWallets.flatMap((w) => {
          const [dr] = getDonorPDA(campaignPDA, w)
          return [
            { pubkey: dr, isSigner: false, isWritable: true },
            { pubkey: w, isSigner: false, isWritable: true },
          ]
        })

        const tx = await (program.methods as any)
          .refundAll()
          .accounts({
            campaign: campaignPDA,
            escrow: escrowPDA,
            caller: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(remainingAccounts)
          .rpc()

        return { tx }
      } catch (err: any) {
        const msg = err?.message || 'refund_all failed'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [wallet.publicKey, getProgram, getCampaignPDA, getEscrowPDA, getDonorPDA],
  )

  /// Send pooled escrow to a contract destination (e.g. contract_registry escrow PDA) after match_funds.
  const finalizeCampaign = useCallback(
    async (
      campaignCreator: PublicKey,
      campaignTitle: string,
      contractPubkey: PublicKey,
      contractDestination: PublicKey,
    ) => {
      if (!wallet.publicKey) throw new Error('Wallet not connected')
      const program = getProgram()
      if (!program) throw new Error('Program not initialized')

      setLoading(true)
      setError(null)
      try {
        const [campaignPDA] = getCampaignPDA(campaignCreator, campaignTitle)
        const [escrowPDA] = getEscrowPDA(campaignPDA)
        const tx = await (program.methods as any)
          .finalizeCampaign(contractPubkey)
          .accounts({
            campaign: campaignPDA,
            escrow: escrowPDA,
            contract: contractDestination,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        return { tx }
      } catch (err: any) {
        const msg = err?.message || 'finalize_campaign failed'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [wallet.publicKey, getProgram, getCampaignPDA, getEscrowPDA],
  )

  // Fetch campaign account from chain by direct address (read-only)
  const fetchCampaignAccountByAddress = useCallback(
    async (address: string | PublicKey) => {
      try {
        const pubkey = typeof address === 'string' ? new PublicKey(address) : address
        return await (readOnlyProgram.account as any).crowdfundingCampaignAccount.fetch(pubkey)
      } catch {
        return null
      }
    },
    [readOnlyProgram],
  )

  // Fetch campaign account from chain (read-only; does not require wallet connect)
  const fetchCampaignAccount = useCallback(
    async (creator: PublicKey, title: string) => {
      const [pda] = getCampaignPDA(creator, title)
      try {
        return await (readOnlyProgram.account as any).crowdfundingCampaignAccount.fetch(pda)
      } catch {
        return null
      }
    },
    [readOnlyProgram, getCampaignPDA],
  )

  return {
    createCampaign,
    contribute,
    matchFunds,
    refundAll,
    finalizeCampaign,
    fetchCampaignAccount,
    fetchCampaignAccountByAddress,
    getCampaignPDA,
    getEscrowPDA,
    getDonorPDA,
    loading,
    error,
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
  }
}
