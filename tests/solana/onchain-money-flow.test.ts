/**
 * On-chain integration tests using solana-bankrun.
 *
 * Loads compiled .so programs into a local BPF runtime (no network required)
 * and verifies REAL SOL movement through escrow, contractor payments,
 * penalties, and the district treasury.
 *
 * Run:  npx vitest run --config vitest.config.solana.ts tests/solana/onchain-money-flow.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
  type Signer,
  type ConfirmOptions,
  type TransactionSignature,
  type VersionedTransaction,
  type SendOptions,
} from '@solana/web3.js'
import { Program, BN, Wallet, BorshCoder } from '@coral-xyz/anchor'
import type Provider from '@coral-xyz/anchor/dist/cjs/provider'
import { start, type ProgramTestContext, type BanksClient } from 'solana-bankrun'
import { PROGRAM_IDS, SEEDS } from '@/lib/web3/constants'
import {
  getContractPDA,
  getEscrowPDA,
  getTreasuryPDA,
} from '@/lib/web3/pda'

import contractRegistryIdl from '@/lib/web3/idl/contract_registry.json'
import penaltyEngineIdl from '@/lib/web3/idl/penalty_engine.json'
import districtTreasuryIdl from '@/lib/web3/idl/district_treasury.json'

// ──────────────────────────────────────────────────────────
// Bankrun ↔ Anchor bridge
// ──────────────────────────────────────────────────────────

/**
 * A Connection-like proxy that routes account reads through bankrun's
 * BanksClient instead of making real RPC calls.  Anchor's account.fetch()
 * calls connection.getAccountInfoAndContext(), so we intercept that.
 */
function createBankrunConnection(banksClient: BanksClient): Connection {
  const conn = new Connection('http://127.0.0.1:8899', 'confirmed')

  // Intercept getAccountInfo — used by Anchor's account namespace
  const origGetAccountInfo = conn.getAccountInfo.bind(conn)
  conn.getAccountInfo = async (publicKey: PublicKey, _commitmentOrConfig?: any) => {
    const acct = await banksClient.getAccount(publicKey)
    if (!acct) return null
    return {
      data: Buffer.from(acct.data),
      executable: acct.executable,
      lamports: Number(acct.lamports),
      owner: new PublicKey(acct.owner),
      rentEpoch: Number(acct.rentEpoch),
    }
  }

  // Intercept getAccountInfoAndContext — used by Anchor's fetchNullableAndContext
  conn.getAccountInfoAndContext = async (publicKey: PublicKey, _commitmentOrConfig?: any) => {
    const info = await conn.getAccountInfo(publicKey)
    return {
      context: { slot: Number(await banksClient.getSlot()) },
      value: info,
    }
  }

  return conn
}

/**
 * Minimal Anchor-compatible provider backed by bankrun's BanksClient.
 *
 * Anchor's `Program.methods.*.rpc()` calls `provider.sendAndConfirm()`,
 * which we redirect to `banksClient.processTransaction()`.
 */
class BankrunProvider implements Provider {
  readonly connection: Connection
  readonly wallet: Wallet
  readonly publicKey: PublicKey
  readonly opts: ConfirmOptions = { commitment: 'confirmed' }

  constructor(
    private ctx: ProgramTestContext,
    private payer: Keypair,
  ) {
    this.connection = createBankrunConnection(ctx.banksClient)
    this.wallet = new Wallet(payer)
    this.publicKey = payer.publicKey
  }

  async sendAndConfirm(
    tx: Transaction | VersionedTransaction,
    signers?: Signer[],
    _opts?: ConfirmOptions,
  ): Promise<TransactionSignature> {
    if (tx instanceof Transaction) {
      tx.recentBlockhash = await getBlockhash(this.ctx)
      tx.feePayer = this.payer.publicKey

      // Sign with payer, then additional signers
      tx.sign(this.payer, ...(signers ?? []))

      await this.ctx.banksClient.processTransaction(tx)
      return tx.signature?.toString() ?? 'bankrun-tx'
    }
    throw new Error('VersionedTransaction not supported in bankrun provider')
  }

  async send(
    tx: Transaction | VersionedTransaction,
    signers?: Signer[],
    _opts?: SendOptions,
  ): Promise<TransactionSignature> {
    return this.sendAndConfirm(tx, signers)
  }

  async sendAll(
    _txWithSigners: { tx: Transaction | VersionedTransaction; signers?: Signer[] }[],
    _opts?: ConfirmOptions,
  ): Promise<Array<TransactionSignature>> {
    throw new Error('sendAll not implemented for bankrun')
  }

  async simulate(
    _tx: Transaction | VersionedTransaction,
    _signers?: Signer[],
  ): Promise<any> {
    throw new Error('simulate not implemented for bankrun')
  }
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const SOL = (n: number) => BigInt(n * LAMPORTS_PER_SOL)

/** Fund an account by injecting lamports directly via bankrun */
function fundAccount(
  ctx: ProgramTestContext,
  pubkey: PublicKey,
  lamports: bigint,
): void {
  ctx.setAccount(pubkey, {
    lamports,
    data: new Uint8Array(0),
    owner: SystemProgram.programId.toBytes(),
    executable: false,
    rentEpoch: 0n,
  } as any)
}

/** Get balance of an account via banksClient */
async function getBalance(client: BanksClient, pubkey: PublicKey): Promise<bigint> {
  return client.getBalance(pubkey)
}

/** Get a recent blockhash from bankrun, handling different return shapes */
async function getBlockhash(ctx: ProgramTestContext): Promise<string> {
  const result = await ctx.banksClient.getLatestBlockhash()
  if (!result) return ctx.lastBlockhash
  if (Array.isArray(result)) return result[0]
  return (result as any).blockhash ?? ctx.lastBlockhash
}

/** Unique title to avoid PDA collisions across tests */
let titleCounter = 0
function uniqueTitle(base: string): string {
  titleCounter += 1
  return `${base}-${titleCounter}-${Date.now().toString(36)}`
}

/** Derive penalty record PDA */
function getPenaltyRecordPDA(contractPubkey: PublicKey, nonce: number): [PublicKey, number] {
  const nonceBuf = Buffer.alloc(8)
  nonceBuf.writeBigUInt64LE(BigInt(nonce))
  return PublicKey.findProgramAddressSync(
    [SEEDS.penalty, contractPubkey.toBuffer(), nonceBuf],
    PROGRAM_IDS.penaltyEngine,
  )
}

/**
 * Directly modify the milestones field in an on-chain GovernmentContract account
 * to set a specific milestone status to UnderReview.
 *
 * This is necessary because the Submitted -> UnderReview transition is normally
 * done by jury_mechanism via CPI, which we bypass in these isolated tests.
 */
async function setMilestoneStatusUnderReview(
  ctx: ProgramTestContext,
  contractPDA: PublicKey,
  milestoneIndex: number,
): Promise<void> {
  const acctInfo = await ctx.banksClient.getAccount(contractPDA)
  if (!acctInfo) throw new Error('Contract account not found')

  const data = Buffer.from(acctInfo.data)

  // GovernmentContract layout after the 8-byte discriminator:
  //   id: Pubkey (32)
  //   authority: Pubkey (32)
  //   contractor: Pubkey (32)
  //   title: String (4 + len)
  //   district: String (4 + len)
  //   total_amount: u64 (8)
  //   escrow_amount: u64 (8)
  //   penalty_amount: u64 (8)
  //   deadline: i64 (8)
  //   status: ContractStatus (1)
  //   lat: f64 (8)
  //   lng: f64 (8)
  //   milestone_count: u8 (1)
  //   milestones_accepted: u8 (1)
  //   created_at: i64 (8)
  //   bump: u8 (1)
  //   milestones: Vec<Milestone> (4 + count * milestone_size)
  //     Each Milestone:
  //       description: String (4 + len)
  //       deadline_days: u16 (2)
  //       tranche_pct: u8 (1)
  //       status: MilestoneStatus (1)  <-- THIS is what we patch
  //       sort_order: u8 (1)

  let offset = 8 // discriminator
  offset += 32   // id
  offset += 32   // authority
  offset += 32   // contractor

  // title: String (4-byte len prefix + bytes)
  const titleLen = data.readUInt32LE(offset)
  offset += 4 + titleLen

  // district: String
  const districtLen = data.readUInt32LE(offset)
  offset += 4 + districtLen

  offset += 8  // total_amount
  offset += 8  // escrow_amount
  offset += 8  // penalty_amount
  offset += 8  // deadline
  offset += 1  // status
  offset += 8  // lat
  offset += 8  // lng
  offset += 1  // milestone_count
  offset += 1  // milestones_accepted
  offset += 8  // created_at
  offset += 1  // bump

  // Vec<Milestone>: 4-byte length prefix
  const msCount = data.readUInt32LE(offset)
  offset += 4

  // Navigate to the target milestone
  for (let i = 0; i < msCount; i++) {
    // description: String
    const descLen = data.readUInt32LE(offset)
    offset += 4 + descLen
    // deadline_days: u16
    offset += 2
    // tranche_pct: u8
    offset += 1

    if (i === milestoneIndex) {
      // status: MilestoneStatus enum (1 byte)
      // UnderReview = 2 (Pending=0, Submitted=1, UnderReview=2, Accepted=3, Rejected=4, Overdue=5)
      data.writeUInt8(2, offset)
    }

    // status: u8
    offset += 1
    // sort_order: u8
    offset += 1
  }

  // Write back the modified account
  ctx.setAccount(contractPDA, {
    lamports: acctInfo.lamports,
    data: new Uint8Array(data),
    owner: new Uint8Array(acctInfo.owner),
    executable: acctInfo.executable,
    rentEpoch: acctInfo.rentEpoch,
  } as any)
}

// ──────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────

describe('On-chain money flow (bankrun)', () => {
  let context: ProgramTestContext
  let banksClient: BanksClient
  let payer: Keypair
  let akimat: Keypair
  let contractor: Keypair

  // Programs bound to specific signers
  let registryForAkimat: Program
  let registryForContractor: Program
  let treasuryForAkimat: Program
  let penaltyForAkimat: Program

  beforeAll(async () => {
    // Start bankrun with all 6 programs loaded from compiled .so files
    context = await start(
      [
        { name: 'contract_registry', programId: PROGRAM_IDS.contractRegistry },
        { name: 'citizen_registry', programId: PROGRAM_IDS.citizenRegistry },
        { name: 'jury_mechanism', programId: PROGRAM_IDS.juryMechanism },
        { name: 'penalty_engine', programId: PROGRAM_IDS.penaltyEngine },
        { name: 'district_treasury', programId: PROGRAM_IDS.districtTreasury },
        { name: 'crowdfunding', programId: PROGRAM_IDS.crowdfunding },
      ],
      [],
    )

    banksClient = context.banksClient
    payer = context.payer

    // Create role keypairs
    akimat = Keypair.generate()
    contractor = Keypair.generate()

    // Fund akimat generously (200 SOL — covers multiple test contract registrations)
    fundAccount(context, akimat.publicKey, SOL(200))
    // Fund contractor with a small amount (just for tx fees when submitting milestones)
    fundAccount(context, contractor.publicKey, SOL(5))

    // Create Anchor programs bound to each role
    const akimatProvider = new BankrunProvider(context, akimat)
    const contractorProvider = new BankrunProvider(context, contractor)

    registryForAkimat = new Program(contractRegistryIdl as any, akimatProvider)
    registryForContractor = new Program(contractRegistryIdl as any, contractorProvider)
    treasuryForAkimat = new Program(districtTreasuryIdl as any, akimatProvider)
    penaltyForAkimat = new Program(penaltyEngineIdl as any, akimatProvider)
  })

  // ═══════════════════════════════════════════════════════
  // TEST 1: Contract Registration -> Escrow Lock
  // ═══════════════════════════════════════════════════════

  describe('Test 1: Contract Registration -> Escrow Lock', () => {
    const totalLamports = 100n * BigInt(LAMPORTS_PER_SOL) // 100 SOL
    let contractPDA: PublicKey
    let escrowPDA: PublicKey
    let title: string
    let akimatBalanceBefore: bigint

    it('registers contract and transfers 20% to escrow PDA', async () => {
      title = uniqueTitle('escrow-lock')
      const [cPDA] = getContractPDA(akimat.publicKey, title)
      const [ePDA] = getEscrowPDA(cPDA)
      contractPDA = cPDA
      escrowPDA = ePDA

      akimatBalanceBefore = await getBalance(banksClient, akimat.publicKey)

      const deadline = Math.floor(Date.now() / 1000) + 86400 // +1 day

      await (registryForAkimat.methods as any)
        .registerContract(
          title,
          'Медеуский',
          new BN(totalLamports.toString()),
          new BN(deadline),
          [
            { description: 'Foundation', deadlineDays: 30, tranchePct: 50 },
            { description: 'Finishing', deadlineDays: 60, tranchePct: 50 },
          ],
          43.27,
          76.94,
        )
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    })

    it('escrow PDA holds exactly 20% of total_amount', async () => {
      const escrowBalance = await getBalance(banksClient, escrowPDA)
      const expected20Pct = totalLamports / 5n // 20 SOL

      expect(escrowBalance).toBe(expected20Pct)
    })

    it('akimat balance decreased by at least the escrow amount', async () => {
      const akimatBalanceAfter = await getBalance(banksClient, akimat.publicKey)
      const expectedEscrow = totalLamports / 5n // 20 SOL
      const spent = akimatBalanceBefore - akimatBalanceAfter

      // Akimat paid escrow (20 SOL) + PDA rent + tx fee
      expect(spent).toBeGreaterThanOrEqual(expectedEscrow)
      // But not wildly more (rent + fees < 0.1 SOL)
      expect(spent).toBeLessThan(expectedEscrow + SOL(1))
    })

    it('on-chain contract state is correct', async () => {
      const account = await (registryForAkimat.account as any).governmentContract.fetch(contractPDA)

      expect(account.authority.toBase58()).toBe(akimat.publicKey.toBase58())
      expect(account.contractor.toBase58()).toBe(contractor.publicKey.toBase58())
      expect(account.title).toBe(title)
      expect(account.district).toBe('Медеуский')
      expect(Number(account.totalAmount)).toBe(Number(totalLamports))
      expect(Number(account.escrowAmount)).toBe(Number(totalLamports / 5n))
      expect(account.status).toHaveProperty('active')
      expect(account.milestoneCount).toBe(2)
      expect(account.milestonesAccepted).toBe(0)
      expect(account.milestones).toHaveLength(2)
      expect(account.milestones[0].tranchePct).toBe(50)
      expect(account.milestones[1].tranchePct).toBe(50)
    })
  })

  // ═══════════════════════════════════════════════════════
  // TEST 2: Milestone Accept -> Escrow -> Contractor Payment
  // ═══════════════════════════════════════════════════════

  describe('Test 2: Milestone Accept -> Escrow to Contractor Payment', () => {
    const totalLamports = 50n * BigInt(LAMPORTS_PER_SOL) // 50 SOL
    let contractPDA: PublicKey
    let escrowPDA: PublicKey
    let title: string

    it('sets up: register contract', async () => {
      title = uniqueTitle('milestone-pay')
      const [cPDA] = getContractPDA(akimat.publicKey, title)
      const [ePDA] = getEscrowPDA(cPDA)
      contractPDA = cPDA
      escrowPDA = ePDA

      const deadline = Math.floor(Date.now() / 1000) + 86400

      await (registryForAkimat.methods as any)
        .registerContract(
          title,
          'Алмалинский',
          new BN(totalLamports.toString()),
          new BN(deadline),
          [
            { description: 'Demolition', deadlineDays: 15, tranchePct: 40 },
            { description: 'Construction', deadlineDays: 45, tranchePct: 60 },
          ],
          43.25,
          76.95,
        )
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      // Fund escrow to full amount so tranche transfers succeed
      // Registration auto-escrowed 20% (10 SOL). Add remaining 80% (40 SOL).
      const fundTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: akimat.publicKey,
          toPubkey: escrowPDA,
          lamports: BigInt(40 * LAMPORTS_PER_SOL),
        }),
      )
      fundTx.recentBlockhash = await getBlockhash(context)
      fundTx.feePayer = akimat.publicKey
      fundTx.sign(akimat)
      await banksClient.processTransaction(fundTx)
    })

    it('contractor submits milestone 0', async () => {
      await (registryForContractor.methods as any)
        .submitMilestone(0, 'QmTestEvidence001')
        .accounts({
          governmentContract: contractPDA,
          contractor: contractor.publicKey,
        })
        .rpc()

      const account = await (registryForAkimat.account as any).governmentContract.fetch(contractPDA)
      expect(account.milestones[0].status).toHaveProperty('submitted')
    })

    it('authority accepts milestone 0 -> contractor receives 40% tranche', async () => {
      // Transition milestone from Submitted -> UnderReview (normally done by jury)
      await setMilestoneStatusUnderReview(context, contractPDA, 0)

      const contractorBefore = await getBalance(banksClient, contractor.publicKey)
      const escrowBefore = await getBalance(banksClient, escrowPDA)

      await (registryForAkimat.methods as any)
        .acceptMilestone(0)
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      const contractorAfter = await getBalance(banksClient, contractor.publicKey)
      const escrowAfter = await getBalance(banksClient, escrowPDA)

      // 40% of 50 SOL = 20 SOL
      const expectedTranche = (totalLamports * 40n) / 100n
      const contractorGain = contractorAfter - contractorBefore
      const escrowDrop = escrowBefore - escrowAfter

      expect(contractorGain).toBe(expectedTranche)
      expect(escrowDrop).toBe(expectedTranche)

      // Verify on-chain state
      const account = await (registryForAkimat.account as any).governmentContract.fetch(contractPDA)
      expect(account.milestones[0].status).toHaveProperty('accepted')
      expect(account.milestonesAccepted).toBe(1)
    })
  })

  // ═══════════════════════════════════════════════════════
  // TEST 3: Penalty -> Treasury Deposit
  // ═══════════════════════════════════════════════════════

  describe('Test 3: Penalty -> Treasury Deposit', () => {
    const totalAmount = 100n * BigInt(LAMPORTS_PER_SOL) // 100 SOL
    const district = 'Бостандыкский'
    let contractRefPDA: PublicKey
    let treasuryPDA: PublicKey

    it('sets up: initialize district treasury', async () => {
      const [tPDA] = getTreasuryPDA(district)
      treasuryPDA = tPDA

      await (treasuryForAkimat.methods as any)
        .initTreasury(district)
        .accounts({
          districtTreasury: treasuryPDA,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      // Verify treasury initialized with zero balance
      const treasury = await (treasuryForAkimat.account as any).districtTreasuryAccount.fetch(treasuryPDA)
      expect(treasury.district).toBe(district)
      expect(Number(treasury.balance)).toBe(0)
    })

    it('sets up: create ContractRef account for penalty engine', async () => {
      // penalty_engine reads a ContractRef account (not the full GovernmentContract).
      // We create this account with proper discriminator + data.
      //
      // ContractRef fields:
      //   total_amount: u64  (8 bytes)
      //   penalty_accumulated: u64  (8 bytes)
      //   district: String  (4 + len bytes)
      //
      // The discriminator for ContractRef is [14, 255, 67, 65, 128, 63, 94, 138]
      const discriminator = Buffer.from([14, 255, 67, 65, 128, 63, 94, 138])
      const totalAmountBuf = Buffer.alloc(8)
      totalAmountBuf.writeBigUInt64LE(totalAmount)
      const penaltyAccumBuf = Buffer.alloc(8)
      penaltyAccumBuf.writeBigUInt64LE(0n) // no prior penalties
      const districtBytes = Buffer.from(district)
      const districtLenBuf = Buffer.alloc(4)
      districtLenBuf.writeUInt32LE(districtBytes.length)

      const accountData = Buffer.concat([
        discriminator,
        totalAmountBuf,
        penaltyAccumBuf,
        districtLenBuf,
        districtBytes,
      ])

      contractRefPDA = Keypair.generate().publicKey

      // Calculate rent-exempt minimum
      const rent = await banksClient.getRent()
      const rentLamports = rent.minimumBalance(BigInt(accountData.length))

      context.setAccount(contractRefPDA, {
        lamports: rentLamports,
        data: new Uint8Array(accountData),
        owner: PROGRAM_IDS.penaltyEngine.toBytes(),
        executable: false,
        rentEpoch: 0n,
      } as any)
    })

    it('execute_penalty transfers SOL to district treasury and records penalty', async () => {
      const nonce = 0
      const [penaltyRecordPDA] = getPenaltyRecordPDA(contractRefPDA, nonce)
      const daysOverdue = 10

      const akimatBefore = await getBalance(banksClient, akimat.publicKey)
      const treasuryBalanceBefore = await getBalance(banksClient, treasuryPDA)

      // Build the instruction manually because the compiled .so has 6 accounts
      // (including district_treasury_program for CPI) but the IDL only lists 5.
      // Anchor's account resolution would produce the wrong account order.
      const coder = new BorshCoder(penaltyEngineIdl as any)
      const ixData = coder.instruction.encode('execute_penalty', {
        nonce: new BN(nonce),
        penaltyType: { timeOverdue: {} },
        daysOverdue: new BN(daysOverdue),
        rejectionCount: 0,
        ghostCount: 0,
      })

      const penaltyIx = new TransactionInstruction({
        programId: PROGRAM_IDS.penaltyEngine,
        keys: [
          // Must match Rust struct field order exactly:
          { pubkey: contractRefPDA, isSigner: false, isWritable: false },      // contract_data
          { pubkey: penaltyRecordPDA, isSigner: false, isWritable: true },     // penalty_record (init)
          { pubkey: treasuryPDA, isSigner: false, isWritable: true },          // district_treasury
          { pubkey: PROGRAM_IDS.districtTreasury, isSigner: false, isWritable: false }, // district_treasury_program
          { pubkey: akimat.publicKey, isSigner: true, isWritable: true },      // caller
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        data: ixData,
      })

      const tx = new Transaction().add(penaltyIx)
      tx.recentBlockhash = await getBlockhash(context)
      tx.feePayer = akimat.publicKey
      tx.sign(akimat)
      await banksClient.processTransaction(tx)

      const akimatAfter = await getBalance(banksClient, akimat.publicKey)
      const treasuryBalanceAfter = await getBalance(banksClient, treasuryPDA)

      // Expected penalty: total_amount * days_overdue / 100 = 100 SOL * 10 / 100 = 10 SOL
      const expectedPenalty = (totalAmount * BigInt(daysOverdue)) / 100n

      // Treasury account lamport balance should have increased
      const treasuryGain = treasuryBalanceAfter - treasuryBalanceBefore
      expect(treasuryGain).toBe(expectedPenalty)

      // Akimat paid the penalty amount + tx fee + PDA rent
      const akimatSpent = akimatBefore - akimatAfter
      expect(akimatSpent).toBeGreaterThanOrEqual(expectedPenalty)

      // Verify penalty record via deserialization
      const penaltyAcctInfo = await banksClient.getAccount(penaltyRecordPDA)
      expect(penaltyAcctInfo).toBeTruthy()
      const record = coder.accounts.decode('PenaltyRecord', Buffer.from(penaltyAcctInfo!.data))
      expect(Number(record.amount)).toBe(Number(expectedPenalty))
      expect(Number(record.daysOverdue)).toBe(daysOverdue)
      expect(record.triggeredBy.toBase58()).toBe(akimat.publicKey.toBase58())

      // Verify district treasury balance field updated via CPI
      const treasury = await (treasuryForAkimat.account as any).districtTreasuryAccount.fetch(treasuryPDA)
      expect(Number(treasury.balance)).toBe(Number(expectedPenalty))
    })

    it('contract penalty_amount is tracked in penalty record', async () => {
      const [penaltyRecordPDA] = getPenaltyRecordPDA(contractRefPDA, 0)
      const penaltyAcctInfo = await banksClient.getAccount(penaltyRecordPDA)
      expect(penaltyAcctInfo).toBeTruthy()

      const coder = new BorshCoder(penaltyEngineIdl as any)
      const record = coder.accounts.decode('PenaltyRecord', Buffer.from(penaltyAcctInfo!.data))

      // 10% penalty for 10 days overdue
      const expectedAmount = (totalAmount * 10n) / 100n
      expect(BigInt(record.amount.toString())).toBe(expectedAmount)
    })
  })

  // ═══════════════════════════════════════════════════════
  // TEST 4: Full Lifecycle (100 SOL, 3 milestones: 30/40/30)
  // ═══════════════════════════════════════════════════════

  describe('Test 4: Full Lifecycle — 100 SOL across 3 milestones', () => {
    const totalLamports = 100n * BigInt(LAMPORTS_PER_SOL)
    let contractPDA: PublicKey
    let escrowPDA: PublicKey
    let title: string
    let contractorStartBalance: bigint

    it('registers 100 SOL contract with milestones [30%, 40%, 30%]', async () => {
      title = uniqueTitle('full-lifecycle')
      const [cPDA] = getContractPDA(akimat.publicKey, title)
      const [ePDA] = getEscrowPDA(cPDA)
      contractPDA = cPDA
      escrowPDA = ePDA

      const deadline = Math.floor(Date.now() / 1000) + 86400 * 30 // +30 days

      await (registryForAkimat.methods as any)
        .registerContract(
          title,
          'Медеуский',
          new BN(totalLamports.toString()),
          new BN(deadline),
          [
            { description: 'Excavation', deadlineDays: 30, tranchePct: 30 },
            { description: 'Structure', deadlineDays: 60, tranchePct: 40 },
            { description: 'Finishing', deadlineDays: 90, tranchePct: 30 },
          ],
          43.27,
          76.94,
        )
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      // Verify 20% escrowed (20 SOL)
      const escrowBal = await getBalance(banksClient, escrowPDA)
      expect(escrowBal).toBe(totalLamports / 5n)

      // Fund escrow to 100% — add remaining 80 SOL
      const fundTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: akimat.publicKey,
          toPubkey: escrowPDA,
          lamports: BigInt(80 * LAMPORTS_PER_SOL),
        }),
      )
      fundTx.recentBlockhash = await getBlockhash(context)
      fundTx.feePayer = akimat.publicKey
      fundTx.sign(akimat)
      await banksClient.processTransaction(fundTx)

      // Confirm escrow now holds 100 SOL
      const escrowFull = await getBalance(banksClient, escrowPDA)
      expect(escrowFull).toBe(totalLamports)

      contractorStartBalance = await getBalance(banksClient, contractor.publicKey)
    })

    it('submit + accept milestone 0 -> contractor receives 30 SOL', async () => {
      // Submit
      await (registryForContractor.methods as any)
        .submitMilestone(0, 'QmExcavation_evidence')
        .accounts({
          governmentContract: contractPDA,
          contractor: contractor.publicKey,
        })
        .rpc()

      // Transition to UnderReview
      await setMilestoneStatusUnderReview(context, contractPDA, 0)

      const contractorBefore = await getBalance(banksClient, contractor.publicKey)
      const escrowBefore = await getBalance(banksClient, escrowPDA)

      // Accept
      await (registryForAkimat.methods as any)
        .acceptMilestone(0)
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      const contractorAfter = await getBalance(banksClient, contractor.publicKey)
      const escrowAfter = await getBalance(banksClient, escrowPDA)

      const tranche30 = (totalLamports * 30n) / 100n // 30 SOL
      expect(contractorAfter - contractorBefore).toBe(tranche30)
      expect(escrowBefore - escrowAfter).toBe(tranche30)

      // Escrow should now hold 70 SOL
      expect(escrowAfter).toBe(totalLamports - tranche30)
    })

    it('submit + accept milestone 1 -> contractor receives 40 SOL', async () => {
      await (registryForContractor.methods as any)
        .submitMilestone(1, 'QmStructure_evidence')
        .accounts({
          governmentContract: contractPDA,
          contractor: contractor.publicKey,
        })
        .rpc()

      await setMilestoneStatusUnderReview(context, contractPDA, 1)

      const contractorBefore = await getBalance(banksClient, contractor.publicKey)
      const escrowBefore = await getBalance(banksClient, escrowPDA)

      await (registryForAkimat.methods as any)
        .acceptMilestone(1)
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      const contractorAfter = await getBalance(banksClient, contractor.publicKey)
      const escrowAfter = await getBalance(banksClient, escrowPDA)

      const tranche40 = (totalLamports * 40n) / 100n // 40 SOL
      expect(contractorAfter - contractorBefore).toBe(tranche40)
      expect(escrowBefore - escrowAfter).toBe(tranche40)

      // Escrow should now hold 30 SOL
      expect(escrowAfter).toBe((totalLamports * 30n) / 100n)
    })

    it('submit + accept milestone 2 -> contractor receives 30 SOL, status = Completed', async () => {
      await (registryForContractor.methods as any)
        .submitMilestone(2, 'QmFinishing_evidence')
        .accounts({
          governmentContract: contractPDA,
          contractor: contractor.publicKey,
        })
        .rpc()

      await setMilestoneStatusUnderReview(context, contractPDA, 2)

      const contractorBefore = await getBalance(banksClient, contractor.publicKey)
      const escrowBefore = await getBalance(banksClient, escrowPDA)

      await (registryForAkimat.methods as any)
        .acceptMilestone(2)
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      const contractorAfter = await getBalance(banksClient, contractor.publicKey)
      const escrowAfter = await getBalance(banksClient, escrowPDA)

      const tranche30 = (totalLamports * 30n) / 100n // 30 SOL
      expect(contractorAfter - contractorBefore).toBe(tranche30)
      expect(escrowBefore - escrowAfter).toBe(tranche30)

      // Contract should be Completed
      const account = await (registryForAkimat.account as any).governmentContract.fetch(contractPDA)
      expect(account.status).toHaveProperty('completed')
      expect(account.milestonesAccepted).toBe(3)
      expect(account.milestoneCount).toBe(3)
    })

    it('escrow is empty after all milestones paid', async () => {
      const escrowFinal = await getBalance(banksClient, escrowPDA)
      expect(escrowFinal).toBe(0n)
    })

    it('contractor received exactly 100 SOL total', async () => {
      const contractorEndBalance = await getBalance(banksClient, contractor.publicKey)
      // Contractor also paid tx fees for 3 submit_milestone calls.
      // Total received = endBalance - startBalance + fees_paid
      // Since submit_milestone fees come from contractor, the net gain is
      // totalLamports minus those fees.
      const netGain = contractorEndBalance - contractorStartBalance

      // Contractor received 100 SOL minus ~3 tx fees (each ~5000 lamports)
      // So net gain should be very close to 100 SOL
      expect(netGain).toBeGreaterThan(totalLamports - SOL(1))
      expect(netGain).toBeLessThanOrEqual(totalLamports)

      // More precisely: contractor gained exactly 100 SOL from tranche payments
      // and lost ~15000 lamports in tx fees for 3 submit_milestone calls.
      // So netGain = 100 SOL - ~15000 lamports
      const feeBudget = 100_000n // generous fee budget
      expect(netGain).toBeGreaterThanOrEqual(totalLamports - feeBudget)
    })
  })

  // ═══════════════════════════════════════════════════════
  // TEST 5: Check Deadline -> Auto-Penalty (contract_registry)
  // ═══════════════════════════════════════════════════════

  describe('Test 5: Check Deadline auto-penalty on overdue contract', () => {
    let contractPDA: PublicKey
    let escrowPDA: PublicKey
    const totalLamports = 50n * BigInt(LAMPORTS_PER_SOL)

    it('registers contract with a deadline in the past', async () => {
      const title = uniqueTitle('deadline-check')
      const [cPDA] = getContractPDA(akimat.publicKey, title)
      const [ePDA] = getEscrowPDA(cPDA)
      contractPDA = cPDA
      escrowPDA = ePDA

      // Set deadline to 5 days ago
      const deadline = Math.floor(Date.now() / 1000) - 5 * 86400

      await (registryForAkimat.methods as any)
        .registerContract(
          title,
          'Турксибский',
          new BN(totalLamports.toString()),
          new BN(deadline),
          [
            { description: 'Overdue work', deadlineDays: 1, tranchePct: 50 },
            { description: 'More overdue', deadlineDays: 2, tranchePct: 50 },
          ],
          43.3,
          76.9,
        )
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      const account = await (registryForAkimat.account as any).governmentContract.fetch(contractPDA)
      expect(account.status).toHaveProperty('active')
      expect(Number(account.penaltyAmount)).toBe(0)
    })

    it('checkDeadline flags contract as Penalized and sets penalty_amount', async () => {
      // Anyone can call checkDeadline — use contractor as caller
      const contractorProvider = new BankrunProvider(context, contractor)
      const registryForCaller = new Program(contractRegistryIdl as any, contractorProvider)

      await (registryForCaller.methods as any)
        .checkDeadline()
        .accounts({
          governmentContract: contractPDA,
          caller: contractor.publicKey,
        })
        .rpc()

      const account = await (registryForAkimat.account as any).governmentContract.fetch(contractPDA)
      expect(account.status).toHaveProperty('penalized')

      // Penalty = total_amount * days_overdue / 100
      // With bankrun's clock, days_overdue depends on the unix timestamp
      // The penalty should be > 0 since deadline is in the past
      expect(Number(account.penaltyAmount)).toBeGreaterThan(0)

      // Penalty capped at 30% max
      const maxPenalty = Number(totalLamports) * 30 / 100
      expect(Number(account.penaltyAmount)).toBeLessThanOrEqual(maxPenalty)
    })
  })

  // ═══════════════════════════════════════════════════════
  // TEST 6: Rejection -> no payment
  // ═══════════════════════════════════════════════════════

  describe('Test 6: Milestone rejection does not transfer SOL', () => {
    const totalLamports = 20n * BigInt(LAMPORTS_PER_SOL)
    let contractPDA: PublicKey
    let escrowPDA: PublicKey

    it('registers contract and submits milestone', async () => {
      const title = uniqueTitle('rejection-test')
      const [cPDA] = getContractPDA(akimat.publicKey, title)
      const [ePDA] = getEscrowPDA(cPDA)
      contractPDA = cPDA
      escrowPDA = ePDA

      const deadline = Math.floor(Date.now() / 1000) + 86400

      await (registryForAkimat.methods as any)
        .registerContract(
          title,
          'Жетысуский',
          new BN(totalLamports.toString()),
          new BN(deadline),
          [
            { description: 'Rejected work', deadlineDays: 15, tranchePct: 60 },
            { description: 'Other work', deadlineDays: 30, tranchePct: 40 },
          ],
          43.22,
          76.88,
        )
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      // Submit milestone 0
      await (registryForContractor.methods as any)
        .submitMilestone(0, 'QmBadEvidence')
        .accounts({
          governmentContract: contractPDA,
          contractor: contractor.publicKey,
        })
        .rpc()
    })

    it('rejecting milestone does not change contractor or escrow balance', async () => {
      const contractorBefore = await getBalance(banksClient, contractor.publicKey)
      const escrowBefore = await getBalance(banksClient, escrowPDA)

      // Reject milestone — uses authority signer
      await (registryForAkimat.methods as any)
        .rejectMilestone(0)
        .accounts({
          governmentContract: contractPDA,
          authority: akimat.publicKey,
        })
        .rpc()

      const contractorAfter = await getBalance(banksClient, contractor.publicKey)
      const escrowAfter = await getBalance(banksClient, escrowPDA)

      // No SOL should have moved to contractor
      expect(contractorAfter).toBe(contractorBefore)
      // Escrow balance unchanged
      expect(escrowAfter).toBe(escrowBefore)

      // Milestone should be in Rejected status
      const account = await (registryForAkimat.account as any).governmentContract.fetch(contractPDA)
      expect(account.milestones[0].status).toHaveProperty('rejected')
    })

    it('contractor can resubmit after rejection', async () => {
      // Submit again (Rejected -> Submitted)
      await (registryForContractor.methods as any)
        .submitMilestone(0, 'QmBetterEvidence')
        .accounts({
          governmentContract: contractPDA,
          contractor: contractor.publicKey,
        })
        .rpc()

      const account = await (registryForAkimat.account as any).governmentContract.fetch(contractPDA)
      expect(account.milestones[0].status).toHaveProperty('submitted')
    })
  })

  // ═══════════════════════════════════════════════════════
  // TEST 7: Treasury balance bookkeeping via deposit
  // ═══════════════════════════════════════════════════════

  describe('Test 7: District treasury deposit bookkeeping', () => {
    const district = 'Ауэзовский'
    let treasuryPDA: PublicKey

    it('initializes treasury with zero balance', async () => {
      const [tPDA] = getTreasuryPDA(district)
      treasuryPDA = tPDA

      await (treasuryForAkimat.methods as any)
        .initTreasury(district)
        .accounts({
          districtTreasury: treasuryPDA,
          authority: akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      const treasury = await (treasuryForAkimat.account as any).districtTreasuryAccount.fetch(treasuryPDA)
      expect(treasury.district).toBe(district)
      expect(Number(treasury.balance)).toBe(0)
      expect(treasury.proposalCount).toBe(0)
    })

    it('deposit increases on-chain balance field correctly', async () => {
      const depositAmount = 5n * BigInt(LAMPORTS_PER_SOL)

      await (treasuryForAkimat.methods as any)
        .deposit(new BN(depositAmount.toString()))
        .accounts({
          districtTreasury: treasuryPDA,
          depositor: akimat.publicKey,
        })
        .rpc()

      const treasury = await (treasuryForAkimat.account as any).districtTreasuryAccount.fetch(treasuryPDA)
      expect(BigInt(treasury.balance.toString())).toBe(depositAmount)
    })

    it('multiple deposits accumulate correctly', async () => {
      const deposit2 = 3n * BigInt(LAMPORTS_PER_SOL)
      const deposit3 = 7n * BigInt(LAMPORTS_PER_SOL)

      await (treasuryForAkimat.methods as any)
        .deposit(new BN(deposit2.toString()))
        .accounts({
          districtTreasury: treasuryPDA,
          depositor: akimat.publicKey,
        })
        .rpc()

      await (treasuryForAkimat.methods as any)
        .deposit(new BN(deposit3.toString()))
        .accounts({
          districtTreasury: treasuryPDA,
          depositor: akimat.publicKey,
        })
        .rpc()

      const treasury = await (treasuryForAkimat.account as any).districtTreasuryAccount.fetch(treasuryPDA)
      // 5 + 3 + 7 = 15 SOL
      const expectedTotal = 15n * BigInt(LAMPORTS_PER_SOL)
      expect(BigInt(treasury.balance.toString())).toBe(expectedTotal)
    })
  })
})
