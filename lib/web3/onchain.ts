'use client'

/**
 * On-chain data fetching utilities for Solana devnet.
 * Used when NEXT_PUBLIC_DATA_SOURCE=onchain.
 *
 * These functions read program accounts directly from Solana RPC
 * and map them to the frontend Contract/Milestone types.
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { PROGRAM_IDS, SOLANA_RPC_URL } from './constants'
import type { Contract, Milestone, ContractStatus, MilestoneStatus } from '@/lib/contracts'
import contractRegistryIdl from './idl/contract_registry.json'

// ─── On-chain enum mappers ───

const CONTRACT_STATUS_MAP: Record<string, ContractStatus> = {
  active: 'active',
  disputed: 'disputed',
  penalized: 'penalized',
  completed: 'completed',
  terminated: 'completed', // display as completed
}

const MILESTONE_STATUS_MAP: Record<string, MilestoneStatus> = {
  pending: 'pending',
  submitted: 'submitted',
  underReview: 'under_review',
  accepted: 'accepted',
  rejected: 'rejected',
  overdue: 'overdue',
}

/** Extract enum variant name from Anchor's { variantName: {} } representation */
function enumVariant(obj: Record<string, unknown>): string {
  return Object.keys(obj)[0]
}

// ─── Public API ───

/** Create a read-only Connection (no wallet needed) */
export function getReadOnlyConnection(): Connection {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || SOLANA_RPC_URL
  return new Connection(rpc, 'confirmed')
}

/** Create a read-only Program instance (no wallet, only for .account.*.all/fetch) */
function getReadOnlyProgram(connection: Connection) {
  // Anchor requires a provider even for read-only; use a dummy wallet
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any) => txs,
  }
  const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: 'confirmed' })
  return new Program(contractRegistryIdl as any, provider)
}

/** Fetch all GovernmentContract accounts from chain and map to frontend Contract[] */
export async function fetchAllContractsOnChain(connection?: Connection): Promise<Contract[]> {
  const conn = connection || getReadOnlyConnection()
  const program = getReadOnlyProgram(conn)

  try {
    const accounts = await (program.account as any).governmentContract.all()
    return accounts.map((acc: any) => mapOnChainContract(acc.account, acc.publicKey))
  } catch (err) {
    console.error('Failed to fetch on-chain contracts:', err)
    return []
  }
}

/** Fetch a single GovernmentContract by its PDA */
export async function fetchContractOnChain(
  contractPDA: PublicKey,
  connection?: Connection,
): Promise<Contract | null> {
  const conn = connection || getReadOnlyConnection()
  const program = getReadOnlyProgram(conn)

  try {
    const account = await (program.account as any).governmentContract.fetch(contractPDA)
    return mapOnChainContract(account, contractPDA)
  } catch {
    return null
  }
}

// ─── Mapper ───

function mapOnChainContract(account: any, pubkey: PublicKey): Contract {
  const statusKey = enumVariant(account.status)
  const deadlineMs = account.deadline.toNumber() * 1000

  return {
    id: pubkey.toBase58(),
    title: account.title,
    contractor: account.contractor.toBase58(),
    amount_usdc: account.totalAmount.toNumber(),
    deadline: new Date(deadlineMs).toISOString(),
    district: account.district,
    status: CONTRACT_STATUS_MAP[statusKey] || 'active',
    lat: account.lat,
    lng: account.lng,
    escrow_amount: account.escrowAmount.toNumber(),
    penalty_amount: account.penaltyAmount.toNumber(),
    days_overdue: deadlineMs < Date.now()
      ? Math.ceil((Date.now() - deadlineMs) / (1000 * 60 * 60 * 24))
      : undefined,
    milestones: (account.milestones || []).map((m: any, i: number): Milestone => {
      const msKey = enumVariant(m.status)
      return {
        id: `${pubkey.toBase58()}-${i}`,
        desc: m.description,
        deadline_days: m.deadlineDays,
        tranche_pct: m.tranchePct,
        status: MILESTONE_STATUS_MAP[msKey] || 'pending',
      }
    }),
  }
}
