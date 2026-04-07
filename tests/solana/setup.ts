/**
 * Solana devnet E2E test setup.
 *
 * Generates ephemeral keypairs for each role (akimat, contractor, citizens),
 * airdrops devnet SOL, and provides AnchorProvider + Program helpers.
 *
 * Usage:  const ctx = await setupTestContext()
 *         // ctx.akimat, ctx.contractor, ctx.citizens[0..2]
 *         // ctx.programs.contractRegistry, ctx.programs.juryMechanism, etc.
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor'
import { PROGRAM_IDS, SOLANA_RPC_URL } from '@/lib/web3/constants'
import {
  getContractPDA,
  getEscrowPDA,
  getCitizenPDA,
  getJurySessionPDA,
  getJuryVotePDA,
  getTreasuryPDA,
} from '@/lib/web3/pda'

import contractRegistryIdl from '@/lib/web3/idl/contract_registry.json'
import citizenRegistryIdl from '@/lib/web3/idl/citizen_registry.json'
import juryMechanismIdl from '@/lib/web3/idl/jury_mechanism.json'
import penaltyEngineIdl from '@/lib/web3/idl/penalty_engine.json'
import districtTreasuryIdl from '@/lib/web3/idl/district_treasury.json'

// ──────────────── Types ────────────────

export interface RoleKeypair {
  keypair: Keypair
  publicKey: PublicKey
  wallet: Wallet
}

export interface TestPrograms {
  contractRegistry: Program
  citizenRegistry: Program
  juryMechanism: Program
  penaltyEngine: Program
  districtTreasury: Program
}

export interface TestContext {
  connection: Connection
  akimat: RoleKeypair
  contractor: RoleKeypair
  citizens: RoleKeypair[] // 3 citizen jurors
  programs: TestPrograms
  /** Create an AnchorProvider for a specific role keypair */
  providerFor: (role: RoleKeypair) => AnchorProvider
  /** Create a program instance bound to a specific role */
  programFor: (idl: any, role: RoleKeypair) => Program
}

// ──────────────── Helpers ────────────────

/** Create a role keypair with an AnchorProvider-compatible Wallet wrapper */
function createRole(): RoleKeypair {
  const keypair = Keypair.generate()
  return {
    keypair,
    publicKey: keypair.publicKey,
    wallet: new Wallet(keypair),
  }
}

/**
 * Airdrop SOL to a pubkey on devnet. Retries on rate-limit (HTTP 429).
 * Devnet allows max 2 SOL per airdrop request.
 */
async function airdropSol(
  connection: Connection,
  pubkey: PublicKey,
  sol: number = 2,
  maxRetries: number = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL)
      await connection.confirmTransaction(sig, 'confirmed')
      return
    } catch (err: any) {
      const msg = err?.message || ''
      // 429 = rate-limited, wait and retry
      if (msg.includes('429') && attempt < maxRetries) {
        await sleep(2000 * attempt)
        continue
      }
      throw err
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ──────────────── Balance helpers ────────────────

/** Get lamport balance of an account */
export async function getBalance(connection: Connection, pubkey: PublicKey): Promise<number> {
  return connection.getBalance(pubkey, 'confirmed')
}

/** Get SOL balance of an account */
export async function getBalanceSol(connection: Connection, pubkey: PublicKey): Promise<number> {
  const lamports = await getBalance(connection, pubkey)
  return lamports / LAMPORTS_PER_SOL
}

/** Get escrow PDA balance for a contract */
export async function getEscrowBalanceSol(
  connection: Connection,
  contractPubkey: PublicKey,
): Promise<number> {
  const [escrowPDA] = getEscrowPDA(contractPubkey)
  return getBalanceSol(connection, escrowPDA)
}

// ──────────────── PDA re-exports for convenience ────────────────

export {
  getContractPDA,
  getEscrowPDA,
  getCitizenPDA,
  getJurySessionPDA,
  getJuryVotePDA,
  getTreasuryPDA,
}

export { BN, LAMPORTS_PER_SOL, SystemProgram, PublicKey }

// ──────────────── Main setup ────────────────

/**
 * Set up the full test context:
 * - 1 akimat (authority) keypair with 2 SOL
 * - 1 contractor keypair with 2 SOL
 * - 3 citizen keypairs with 1 SOL each
 * - Program instances for all 5 programs
 */
export async function setupTestContext(): Promise<TestContext> {
  const rpcUrl = process.env.SOLANA_TEST_RPC_URL || SOLANA_RPC_URL
  const connection = new Connection(rpcUrl, 'confirmed')

  // Generate ephemeral keypairs
  const akimat = createRole()
  const contractor = createRole()
  const citizens = [createRole(), createRole(), createRole()]

  // Airdrop to all roles in parallel
  console.log('  Airdropping devnet SOL to test wallets...')
  await Promise.all([
    airdropSol(connection, akimat.publicKey, 2),
    airdropSol(connection, contractor.publicKey, 2),
    ...citizens.map((c) => airdropSol(connection, c.publicKey, 1)),
  ])

  // Helper to create provider for a specific role
  const providerFor = (role: RoleKeypair): AnchorProvider =>
    new AnchorProvider(connection, role.wallet, { commitment: 'confirmed' })

  const programFor = (idl: any, role: RoleKeypair): Program =>
    new Program(idl as any, providerFor(role))

  // Create program instances bound to akimat by default
  const programs: TestPrograms = {
    contractRegistry: programFor(contractRegistryIdl, akimat),
    citizenRegistry: programFor(citizenRegistryIdl, akimat),
    juryMechanism: programFor(juryMechanismIdl, akimat),
    penaltyEngine: programFor(penaltyEngineIdl, akimat),
    districtTreasury: programFor(districtTreasuryIdl, akimat),
  }

  console.log('  Test wallets funded:')
  console.log(`    Akimat:     ${akimat.publicKey.toBase58()}`)
  console.log(`    Contractor: ${contractor.publicKey.toBase58()}`)
  citizens.forEach((c, i) =>
    console.log(`    Citizen ${i + 1}:  ${c.publicKey.toBase58()}`),
  )

  return {
    connection,
    akimat,
    contractor,
    citizens,
    programs,
    providerFor,
    programFor,
  }
}

// ──────────────── High-level test helpers ────────────────

/** Unique title for each test run to avoid PDA collisions */
export function uniqueTitle(base: string): string {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

/** Normalize title for PDA seed (same logic as frontend) */
export function normalizeTitle(title: string): string {
  // On-chain seeds are limited to ~32 bytes; truncate and add hash if needed
  const encoder = new TextEncoder()
  const bytes = encoder.encode(title)
  if (bytes.length <= 32) return title
  const prefix = title.slice(0, 20)
  // Simple hash suffix from full title
  let h = 0
  for (let i = 0; i < bytes.length; i++) {
    h = ((h << 5) - h + bytes[i]) | 0
  }
  return `${prefix}-${(h >>> 0).toString(16).padStart(8, '0')}`
}

/**
 * Register a contract on-chain as akimat. Returns contract PDA and escrow PDA.
 */
export async function registerTestContract(
  ctx: TestContext,
  opts: {
    title?: string
    district?: string
    totalLamports?: number
    deadlineUnix?: number
    milestones?: Array<{ description: string; deadlineDays: number; tranchePct: number }>
    lat?: number
    lng?: number
  } = {},
) {
  const title = normalizeTitle(opts.title || uniqueTitle('test-contract'))
  const district = opts.district || 'Медеуский'
  const totalLamports = opts.totalLamports || 1 * LAMPORTS_PER_SOL // 1 SOL
  const deadlineUnix = opts.deadlineUnix || Math.floor(Date.now() / 1000) + 3600 // +1 hour
  const milestones = opts.milestones || [
    { description: 'Phase 1', deadlineDays: 1, tranchePct: 50 },
    { description: 'Phase 2', deadlineDays: 2, tranchePct: 50 },
  ]
  const lat = opts.lat || 43.27
  const lng = opts.lng || 76.94

  const [contractPDA] = getContractPDA(ctx.akimat.publicKey, title)
  const [escrowPDA] = getEscrowPDA(contractPDA)

  const program = ctx.programFor(contractRegistryIdl, ctx.akimat)

  const tx = await (program.methods as any)
    .registerContract(
      title,
      district,
      new BN(totalLamports),
      new BN(deadlineUnix),
      milestones,
      lat,
      lng,
    )
    .accounts({
      governmentContract: contractPDA,
      escrow: escrowPDA,
      contractor: ctx.contractor.publicKey,
      authority: ctx.akimat.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()

  return { tx, contractPDA, escrowPDA, title, totalLamports }
}

/**
 * Fund escrow PDA via SystemProgram.transfer from a given role.
 */
export async function fundTestEscrow(
  ctx: TestContext,
  contractPDA: PublicKey,
  funder: RoleKeypair,
  lamports: number,
): Promise<string> {
  const [escrowPDA] = getEscrowPDA(contractPDA)
  const provider = ctx.providerFor(funder)

  const instruction = SystemProgram.transfer({
    fromPubkey: funder.publicKey,
    toPubkey: escrowPDA,
    lamports,
  })
  const transaction = new Transaction().add(instruction)
  const tx = await provider.sendAndConfirm(transaction)
  return tx
}

/**
 * Contractor submits a milestone on-chain.
 */
export async function submitTestMilestone(
  ctx: TestContext,
  contractPDA: PublicKey,
  milestoneIndex: number,
  evidenceHash: string = 'QmTestEvidence123',
): Promise<string> {
  const program = ctx.programFor(contractRegistryIdl, ctx.contractor)

  const tx = await (program.methods as any)
    .submitMilestone(milestoneIndex, evidenceHash)
    .accounts({
      governmentContract: contractPDA,
      contractor: ctx.contractor.publicKey,
    })
    .rpc()

  return tx
}

/**
 * Akimat accepts a milestone — releases tranche from escrow to contractor.
 */
export async function acceptTestMilestone(
  ctx: TestContext,
  contractPDA: PublicKey,
  milestoneIndex: number,
): Promise<string> {
  const [escrowPDA] = getEscrowPDA(contractPDA)
  const program = ctx.programFor(contractRegistryIdl, ctx.akimat)

  const tx = await (program.methods as any)
    .acceptMilestone(milestoneIndex)
    .accounts({
      governmentContract: contractPDA,
      escrow: escrowPDA,
      contractor: ctx.contractor.publicKey,
      authority: ctx.akimat.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()

  return tx
}

/**
 * Akimat rejects a milestone.
 */
export async function rejectTestMilestone(
  ctx: TestContext,
  contractPDA: PublicKey,
  milestoneIndex: number,
): Promise<string> {
  const program = ctx.programFor(contractRegistryIdl, ctx.akimat)

  const tx = await (program.methods as any)
    .rejectMilestone(milestoneIndex)
    .accounts({
      governmentContract: contractPDA,
      authority: ctx.akimat.publicKey,
    })
    .rpc()

  return tx
}

/**
 * Anyone calls checkDeadline to flag overdue milestones.
 */
export async function checkTestDeadline(
  ctx: TestContext,
  contractPDA: PublicKey,
  caller: RoleKeypair,
): Promise<string> {
  const program = ctx.programFor(contractRegistryIdl, caller)

  const tx = await (program.methods as any)
    .checkDeadline()
    .accounts({
      governmentContract: contractPDA,
      caller: caller.publicKey,
    })
    .rpc()

  return tx
}

/**
 * Akimat terminates a contract.
 */
export async function terminateTestContract(
  ctx: TestContext,
  contractPDA: PublicKey,
): Promise<string> {
  const program = ctx.programFor(contractRegistryIdl, ctx.akimat)

  const tx = await (program.methods as any)
    .terminateContract()
    .accounts({
      governmentContract: contractPDA,
      authority: ctx.akimat.publicKey,
    })
    .rpc()

  return tx
}

/**
 * Fetch the on-chain GovernmentContract account data.
 */
export async function fetchContractAccount(ctx: TestContext, contractPDA: PublicKey) {
  const program = ctx.programs.contractRegistry
  return (program.account as any).governmentContract.fetch(contractPDA)
}
