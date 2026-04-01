'use client'

import { useCallback, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { PROGRAM_IDS, SEEDS } from './constants'
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

export function useCrowdfunding() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const msg = err?.message || 'Failed to create campaign'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, getCampaignPDA, getEscrowPDA])

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
      const msg = err?.message || 'Contribution failed'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, getCampaignPDA, getEscrowPDA, getDonorPDA])

  // Fetch campaign account from chain
  const fetchCampaignAccount = useCallback(async (creator: PublicKey, title: string) => {
    const program = getProgram()
    if (!program) return null

    const [pda] = getCampaignPDA(creator, title)
    try {
      const account = await (program.account as any).crowdfundingCampaignAccount.fetch(pda)
      return account
    } catch {
      return null
    }
  }, [getProgram, getCampaignPDA])

  return {
    createCampaign,
    contribute,
    fetchCampaignAccount,
    getCampaignPDA,
    getEscrowPDA,
    getDonorPDA,
    loading,
    error,
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
  }
}
