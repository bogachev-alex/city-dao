'use client'

/**
 * Central hook for fetching contracts in dual-mode.
 *
 * - "mock" → returns DEMO_CONTRACTS from lib/contracts.ts
 * - "onchain" → reads GovernmentContract accounts from Solana devnet,
 *   falls back to DEMO_CONTRACTS if chain is empty or unavailable
 */

import { useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useDataSource } from './useDataSource'
import { fetchAllContractsOnChain, fetchContractOnChain } from './onchain'
import { DEMO_CONTRACTS, getContractById, type Contract } from '@/lib/contracts'
import { PublicKey } from '@solana/web3.js'

interface UseContractsResult {
  contracts: Contract[]
  loading: boolean
  error: string | null
  /** True when showing mock/demo data (either by choice or fallback) */
  isMock: boolean
  refetch: () => void
}

export function useContracts(): UseContractsResult {
  const mode = useDataSource()
  const { connection } = useConnection()
  const [contracts, setContracts] = useState<Contract[]>(DEMO_CONTRACTS)
  const [loading, setLoading] = useState(mode === 'onchain')
  const [error, setError] = useState<string | null>(null)
  const [isMock, setIsMock] = useState(true)

  const fetchData = async () => {
    if (mode === 'mock') {
      setContracts(DEMO_CONTRACTS)
      setIsMock(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const onChain = await fetchAllContractsOnChain(connection)
      if (onChain.length > 0) {
        setContracts(onChain)
        setIsMock(false)
      } else {
        // Fallback: no on-chain data yet, show demo
        setContracts(DEMO_CONTRACTS)
        setIsMock(true)
      }
    } catch (err: any) {
      console.error('On-chain fetch failed, falling back to mock:', err)
      setError(err?.message || 'Failed to fetch on-chain contracts')
      setContracts(DEMO_CONTRACTS)
      setIsMock(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return { contracts, loading, error, isMock, refetch: fetchData }
}

// ─── Single contract hook ───

interface UseContractResult {
  contract: Contract | null
  loading: boolean
  isMock: boolean
}

export function useContract(id: string): UseContractResult {
  const mode = useDataSource()
  const { connection } = useConnection()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMock, setIsMock] = useState(true)

  useEffect(() => {
    if (mode === 'mock') {
      setContract(getContractById(id) || null)
      setIsMock(true)
      setLoading(false)
      return
    }

    // In onchain mode, id is a base58 PDA address
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const pubkey = new PublicKey(id)
        const onChain = await fetchContractOnChain(pubkey, connection)
        if (!cancelled) {
          if (onChain) {
            setContract(onChain)
            setIsMock(false)
          } else {
            // Fallback to demo by numeric id
            setContract(getContractById(id) || null)
            setIsMock(true)
          }
        }
      } catch {
        // Invalid pubkey or fetch failed — try demo id
        if (!cancelled) {
          setContract(getContractById(id) || null)
          setIsMock(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [id, mode, connection])

  return { contract, loading, isMock }
}
