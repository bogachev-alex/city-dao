'use client'

import { useCallback, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { PROGRAM_IDS, SOLANA_NETWORK } from './constants'
import { getJurySessionPDA, getJuryVotePDA } from './pda'
import idl from './idl/jury_mechanism.json'

/** Read-only wallet stub for fetching without user signature */
const READ_ONLY_WALLET = {
  publicKey: PublicKey.default,
  signTransaction: async <T>(tx: T) => tx,
  signAllTransactions: async <T>(txs: T[]) => txs,
}

export type JuryVoteValue = 'accept' | 'reject'

export function useJuryMechanism() {
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
      return `Jury program is not deployed on ${PROGRAM_IDS.juryMechanism.toBase58()} in ${SOLANA_NETWORK}.`
    }
    if (raw.includes('already in use')) {
      return 'Jury session already exists for this milestone.'
    }
    return raw || 'Jury operation failed'
  }, [])

  const getProgram = useCallback(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    return new Program(idl as any, provider)
  }, [connection, wallet])

  /**
   * Authority initiates a jury session for a given contract + milestone.
   */
  const initSession = useCallback(async (
    contractPubkey: PublicKey,
    milestoneIndex: number,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [sessionPDA] = getJurySessionPDA(contractPubkey, milestoneIndex)

      const tx = await (program.methods as any)
        .initSession(contractPubkey, milestoneIndex)
        .accounts({
          jurySession: sessionPDA,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Jury session initialized:', tx)
      return { tx, pda: sessionPDA.toBase58() }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, toReadableError])

  /**
   * Authority provides VRF result + juror list after off-chain randomness.
   * vrfResult: 32-byte random seed (e.g. from Switchboard VRF).
   * jurors: list of citizen wallet addresses selected for this session.
   * expertIndex: index in jurors[] that is the expert (weight x2).
   */
  const selectJury = useCallback(async (
    contractPubkey: PublicKey,
    milestoneIndex: number,
    vrfResult: Uint8Array,
    jurors: PublicKey[],
    expertIndex: number,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [sessionPDA] = getJurySessionPDA(contractPubkey, milestoneIndex)

      const tx = await (program.methods as any)
        .selectJury(Array.from(vrfResult), jurors, expertIndex)
        .accounts({
          jurySession: sessionPDA,
          authority: wallet.publicKey,
        })
        .rpc()

      return { tx }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, toReadableError])

  /**
   * Juror commits a hashed vote during COMMIT_PHASE.
   * voteHash: SHA-256(vote || salt) — 32 bytes, computed via lib/crypto.ts.
   */
  const commitVote = useCallback(async (
    contractPubkey: PublicKey,
    milestoneIndex: number,
    voteHash: Uint8Array,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [sessionPDA] = getJurySessionPDA(contractPubkey, milestoneIndex)
      const [votePDA] = getJuryVotePDA(sessionPDA, wallet.publicKey)

      const tx = await (program.methods as any)
        .commitVote(Array.from(voteHash))
        .accounts({
          jurySession: sessionPDA,
          juryVote: votePDA,
          juror: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Vote committed on-chain:', tx)
      return { tx }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, toReadableError])

  /**
   * Authority transitions session from COMMIT_PHASE to REVEAL_PHASE.
   */
  const startRevealPhase = useCallback(async (
    contractPubkey: PublicKey,
    milestoneIndex: number,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [sessionPDA] = getJurySessionPDA(contractPubkey, milestoneIndex)

      const tx = await (program.methods as any)
        .startRevealPhase()
        .accounts({
          jurySession: sessionPDA,
          authority: wallet.publicKey,
        })
        .rpc()

      return { tx }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, toReadableError])

  /**
   * Juror reveals their vote during REVEAL_PHASE.
   * vote: 'accept' | 'reject'
   * salt: 32-byte salt used when computing the commit hash.
   */
  const revealVote = useCallback(async (
    contractPubkey: PublicKey,
    milestoneIndex: number,
    vote: JuryVoteValue,
    salt: Uint8Array,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [sessionPDA] = getJurySessionPDA(contractPubkey, milestoneIndex)
      const [votePDA] = getJuryVotePDA(sessionPDA, wallet.publicKey)

      // Map to on-chain enum format
      const voteEnum = vote === 'accept' ? { accept: {} } : { reject: {} }

      const tx = await (program.methods as any)
        .revealVote(voteEnum, Array.from(salt))
        .accounts({
          jurySession: sessionPDA,
          juryVote: votePDA,
          juror: wallet.publicKey,
        })
        .rpc()

      console.log('Vote revealed on-chain:', tx)
      return { tx }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, toReadableError])

  /**
   * Authority finalizes the session with tallied weighted votes.
   * weightedAccept / weightedReject are the vote sums computed off-chain
   * after the reveal phase closes.
   */
  const finalizeSession = useCallback(async (
    contractPubkey: PublicKey,
    milestoneIndex: number,
    weightedAccept: number,
    weightedReject: number,
  ) => {
    if (!wallet.publicKey) throw new Error('Wallet not connected')
    const program = getProgram()
    if (!program) throw new Error('Program not initialized')

    setLoading(true)
    setError(null)

    try {
      const [sessionPDA] = getJurySessionPDA(contractPubkey, milestoneIndex)

      const tx = await (program.methods as any)
        .finalizeSession(weightedAccept, weightedReject)
        .accounts({
          jurySession: sessionPDA,
          authority: wallet.publicKey,
        })
        .rpc()

      return { tx }
    } catch (err: any) {
      const msg = toReadableError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [wallet.publicKey, getProgram, toReadableError])

  // ─── Read-only ───

  /** Fetch jury session account by contract + milestone index */
  const fetchSession = useCallback(async (
    contractPubkey: PublicKey,
    milestoneIndex: number,
  ) => {
    const [sessionPDA] = getJurySessionPDA(contractPubkey, milestoneIndex)
    try {
      return await (readOnlyProgram.account as any).jurySession.fetch(sessionPDA)
    } catch {
      return null
    }
  }, [readOnlyProgram])

  /** Fetch all JuryVoteAccount records for a given session PDA */
  const fetchVotes = useCallback(async (sessionPDA: PublicKey) => {
    try {
      const accounts = await (readOnlyProgram.account as any).juryVoteAccount.all([
        { memcmp: { offset: 8, bytes: sessionPDA.toBase58() } },
      ])
      return (accounts as any[]).map((a: any) => ({
        publicKey: a.publicKey as PublicKey,
        juror: a.account.juror as PublicKey,
        session: a.account.session as PublicKey,
        commitHash: a.account.commitHash as number[] | null,
        revealedVote: a.account.revealedVote ?? null,
        bump: a.account.bump as number,
      }))
    } catch {
      return []
    }
  }, [readOnlyProgram])

  return {
    initSession,
    selectJury,
    commitVote,
    startRevealPhase,
    revealVote,
    finalizeSession,
    fetchSession,
    fetchVotes,
    getJurySessionPDA: (contract: PublicKey, idx: number) => getJurySessionPDA(contract, idx),
    getJuryVotePDA: (session: PublicKey, juror: PublicKey) => getJuryVotePDA(session, juror),
    loading,
    error,
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
  }
}
