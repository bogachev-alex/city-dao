/**
 * Optional Solana devnet registration for goszakup DB seed rows (contract_registry program).
 * On-chain `total_amount` uses capped lamports — not real tenge (would exceed u64 / wallet balance).
 */

import * as fs from 'fs'
import * as path from 'path'
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { AnchorProvider, Program, BN, Wallet } from '@coral-xyz/anchor'
import { getContractPDA, getEscrowPDA } from './web3/pda'
import { normalizeContractTitleSeed } from './web3/contractTitleSeed'

const IDL_PATH = path.join(__dirname, 'web3', 'idl', 'contract_registry.json')

export type MilestoneOnChainInput = {
  description: string
  deadlineDays: number
  tranchePct: number
}

function truncateUtf8(input: string, maxBytes: number): string {
  let s = input
  while (Buffer.byteLength(s, 'utf8') > maxBytes) {
    s = s.slice(0, -1)
  }
  return s
}

export function loadSolanaKeypair(walletPath: string): Keypair {
  const raw = fs.readFileSync(walletPath, 'utf-8')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
}

export type GoszakupOnChainEnv = {
  connection: Connection
  program: Program
  authority: Keypair
  contractorPubkey: PublicKey
  lamportsPerContract: number
}

export async function createGoszakupOnChainEnv(): Promise<GoszakupOnChainEnv> {
  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    'https://api.devnet.solana.com'
  const walletPath = process.env.SOLANA_WALLET
  const contractorStr = process.env.GOSZAKUP_ONCHAIN_CONTRACTOR
  if (!walletPath) {
    throw new Error('SEED_GOSZAKUP_ONCHAIN=1 requires SOLANA_WALLET (path to authority keypair JSON)')
  }
  if (!contractorStr) {
    throw new Error(
      'SEED_GOSZAKUP_ONCHAIN=1 requires GOSZAKUP_ONCHAIN_CONTRACTOR (base58 contractor wallet pubkey)',
    )
  }

  const parsed = Number(process.env.GOSZAKUP_ONCHAIN_LAMPORTS || 100_000_000)
  const lamportsPerContract = Math.min(1_000_000_000, Math.max(10_000_000, Number.isFinite(parsed) ? parsed : 100_000_000))

  const authority = loadSolanaKeypair(walletPath)
  const contractorPubkey = new PublicKey(contractorStr)
  const connection = new Connection(rpcUrl, 'confirmed')
  const wallet = new Wallet(authority)
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'))
  const program = new Program(idl as any, provider)

  const bal = await connection.getBalance(authority.publicKey)
  if (bal < LAMPORTS_PER_SOL * 0.5) {
    console.warn(
      `[goszakup on-chain] Low SOL (${(bal / LAMPORTS_PER_SOL).toFixed(3)}). Fund ${authority.publicKey.toBase58()} if txs fail.`,
    )
  }

  console.log(
    `[goszakup on-chain] RPC=${rpcUrl} authority=${authority.publicKey.toBase58()} lamports/contract=${lamportsPerContract}`,
  )

  return { connection, program, authority, contractorPubkey, lamportsPerContract }
}

async function accountExists(connection: Connection, pk: PublicKey): Promise<boolean> {
  const info = await connection.getAccountInfo(pk)
  return info !== null
}

export async function registerGoszakupRowOnChain(
  env: GoszakupOnChainEnv,
  params: {
    dbTitle: string
    district: string
    deadlineUnix: number
    lat: number
    lng: number
    milestones: MilestoneOnChainInput[]
  },
): Promise<string> {
  const onChainTitle = normalizeContractTitleSeed(params.dbTitle)
  const [contractPDA] = getContractPDA(env.authority.publicKey, onChainTitle)
  const [escrowPDA] = getEscrowPDA(contractPDA)

  if (await accountExists(env.connection, contractPDA)) {
    return contractPDA.toBase58()
  }

  const milestoneInputs = params.milestones.map((m) => ({
    description: truncateUtf8(m.description, 120),
    deadlineDays: m.deadlineDays,
    tranchePct: m.tranchePct,
  }))

  try {
    await (env.program.methods as any)
      .registerContract(
        onChainTitle,
        params.district,
        new BN(env.lamportsPerContract),
        new BN(params.deadlineUnix),
        milestoneInputs,
        params.lat,
        params.lng,
      )
      .accounts({
        governmentContract: contractPDA,
        escrow: escrowPDA,
        contractor: env.contractorPubkey,
        authority: env.authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err || '')
    if (raw.includes('already in use') || raw.includes('Allocate: account')) {
      return contractPDA.toBase58()
    }
    throw err
  }

  return contractPDA.toBase58()
}
