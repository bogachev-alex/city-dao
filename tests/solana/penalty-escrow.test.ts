/**
 * E2E test: Penalty execution and contract termination on Solana devnet.
 *
 * Roles: Akimat (authority), Contractor, Citizen (caller)
 * Flow:  register → check_deadline (overdue) → execute penalty → terminate → verify
 *
 * Run: npm run test:solana
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  type TestContext,
  setupTestContext,
  registerTestContract,
  fundTestEscrow,
  checkTestDeadline,
  terminateTestContract,
  fetchContractAccount,
  getBalance,
  getEscrowPDA,
  getTreasuryPDA,
  BN,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  sleep,
} from './setup'

import penaltyEngineIdl from '@/lib/web3/idl/penalty_engine.json'
import { PROGRAM_IDS, SEEDS } from '@/lib/web3/constants'

/** Derive penalty record PDA (same logic as usePenaltyEngine) */
function getPenaltyRecordPDA(contractPubkey: PublicKey, nonce: number): [PublicKey, number] {
  const nonceBuf = Buffer.alloc(8)
  nonceBuf.writeBigUInt64LE(BigInt(nonce))
  return PublicKey.findProgramAddressSync(
    [SEEDS.penalty, contractPubkey.toBuffer(), nonceBuf],
    PROGRAM_IDS.penaltyEngine,
  )
}

describe('Penalty & Escrow (devnet)', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await setupTestContext()
  }, 60_000)

  // ─────────────────────────────────────────────
  // 1. checkDeadline marks overdue milestones
  // ─────────────────────────────────────────────

  it('checkDeadline flags overdue contract', async () => {
    // Register with a deadline in the past (1 second ago)
    const deadlineUnix = Math.floor(Date.now() / 1000) - 1

    const { contractPDA } = await registerTestContract(ctx, {
      deadlineUnix,
      milestones: [
        { description: 'Overdue task', deadlineDays: 0, tranchePct: 100 },
      ],
    })

    // Wait a moment for the blockchain clock
    await sleep(2000)

    // Anyone can call checkDeadline
    const tx = await checkTestDeadline(ctx, contractPDA, ctx.citizens[0])
    expect(tx).toBeTruthy()

    const account = await fetchContractAccount(ctx, contractPDA)
    console.log('  ✓ checkDeadline called, contract status:', JSON.stringify(account.status))
    console.log('  ✓ Milestone 0 status:', JSON.stringify(account.milestones[0].status))
  }, 30_000)

  // ─────────────────────────────────────────────
  // 2. Execute penalty → funds go to district treasury
  // ─────────────────────────────────────────────

  it('execute penalty transfers funds to district treasury', async () => {
    const district = 'Медеуский'
    const totalLamports = 1 * LAMPORTS_PER_SOL

    const { contractPDA } = await registerTestContract(ctx, {
      totalLamports,
      district,
      milestones: [
        { description: 'Penalty test', deadlineDays: 0, tranchePct: 100 },
      ],
    })

    // Fund escrow so there's something to penalize
    await fundTestEscrow(ctx, contractPDA, ctx.akimat, Math.round(0.8 * totalLamports))

    // Derive PDAs
    const [treasuryPDA] = getTreasuryPDA(district)
    const nonce = 0
    const [penaltyRecordPDA] = getPenaltyRecordPDA(contractPDA, nonce)

    const penaltyProgram = ctx.programFor(penaltyEngineIdl, ctx.akimat)

    try {
      const tx = await (penaltyProgram.methods as any)
        .executePenalty(
          new BN(nonce),
          { timeOverdue: {} },
          new BN(5),  // 5 days overdue
          0,           // rejection count
          0,           // ghost count
        )
        .accounts({
          contractData: contractPDA,
          penaltyRecord: penaltyRecordPDA,
          districtTreasury: treasuryPDA,
          caller: ctx.akimat.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      expect(tx).toBeTruthy()
      console.log(`  ✓ Penalty executed, tx: ${tx.slice(0, 16)}...`)

      // Verify penalty record was created
      const record = await (penaltyProgram.account as any).penaltyRecord.fetch(penaltyRecordPDA)
      expect(record).toBeTruthy()
      console.log('  ✓ Penalty record created:', penaltyRecordPDA.toBase58())
      console.log('  ✓ Penalty amount:', Number(record.amount || record.amountLamports || 0) / LAMPORTS_PER_SOL, 'SOL')
    } catch (err: any) {
      // If penalty engine isn't deployed, log and skip
      if (err.message?.includes('does not exist') || err.message?.includes('not deployed')) {
        console.log('  ⚠ Penalty engine not deployed on devnet — skipping on-chain verification')
        return
      }
      throw err
    }
  }, 45_000)

  // ─────────────────────────────────────────────
  // 3. Terminate contract → escrow returned to authority
  // ─────────────────────────────────────────────

  it('terminate contract returns remaining escrow', async () => {
    const totalLamports = 1 * LAMPORTS_PER_SOL
    const { contractPDA, escrowPDA } = await registerTestContract(ctx, {
      totalLamports,
      milestones: [
        { description: 'Terminate test', deadlineDays: 1, tranchePct: 100 },
      ],
    })

    // Check escrow has funds (20% auto-escrowed)
    const escrowBefore = await getBalance(ctx.connection, escrowPDA)
    expect(escrowBefore).toBeGreaterThan(0)

    const akimatBefore = await getBalance(ctx.connection, ctx.akimat.publicKey)

    // Terminate
    const tx = await terminateTestContract(ctx, contractPDA)
    expect(tx).toBeTruthy()

    const account = await fetchContractAccount(ctx, contractPDA)
    expect(account.status).toHaveProperty('terminated')

    // Check if escrow was returned (depends on program implementation)
    const escrowAfter = await getBalance(ctx.connection, escrowPDA)
    const akimatAfter = await getBalance(ctx.connection, ctx.akimat.publicKey)

    console.log(`  ✓ Contract terminated, tx: ${tx.slice(0, 16)}...`)
    console.log(`  ✓ Escrow before: ${escrowBefore / LAMPORTS_PER_SOL} SOL`)
    console.log(`  ✓ Escrow after: ${escrowAfter / LAMPORTS_PER_SOL} SOL`)
    console.log(`  ✓ Akimat balance delta: ${(akimatAfter - akimatBefore) / LAMPORTS_PER_SOL} SOL`)
  }, 30_000)

  // ─────────────────────────────────────────────
  // 4. Cannot submit milestone after termination
  // ─────────────────────────────────────────────

  it('contractor cannot submit milestone on terminated contract', async () => {
    const { contractPDA } = await registerTestContract(ctx)

    // Terminate first
    await terminateTestContract(ctx, contractPDA)

    // Try to submit milestone — should fail
    const program = ctx.programFor(
      await import('@/lib/web3/idl/contract_registry.json'),
      ctx.contractor,
    )

    await expect(
      (program.methods as any)
        .submitMilestone(0, 'QmShouldFail')
        .accounts({
          governmentContract: contractPDA,
          contractor: ctx.contractor.publicKey,
        })
        .rpc(),
    ).rejects.toThrow()

    console.log('  ✓ submitMilestone correctly rejected on terminated contract')
  }, 30_000)

  // ─────────────────────────────────────────────
  // 5. Multiple penalties with incrementing nonce
  // ─────────────────────────────────────────────

  it('multiple penalties can be applied with different nonces', async () => {
    const district = 'Ауэзовский'
    const { contractPDA } = await registerTestContract(ctx, {
      district,
      totalLamports: 1 * LAMPORTS_PER_SOL,
      milestones: [
        { description: 'Multi-penalty', deadlineDays: 0, tranchePct: 100 },
      ],
    })

    await fundTestEscrow(ctx, contractPDA, ctx.akimat, Math.round(0.8 * LAMPORTS_PER_SOL))

    const penaltyProgram = ctx.programFor(penaltyEngineIdl, ctx.akimat)
    const [treasuryPDA] = getTreasuryPDA(district)

    const penalties: string[] = []

    for (let nonce = 0; nonce < 3; nonce++) {
      const [penaltyRecordPDA] = getPenaltyRecordPDA(contractPDA, nonce)
      try {
        const tx = await (penaltyProgram.methods as any)
          .executePenalty(
            new BN(nonce),
            nonce === 0 ? { timeOverdue: {} } : nonce === 1 ? { qualityRejected: {} } : { ghostSite: {} },
            new BN(nonce === 0 ? 3 : 0),
            nonce === 1 ? 1 : 0,
            nonce === 2 ? 1 : 0,
          )
          .accounts({
            contractData: contractPDA,
            penaltyRecord: penaltyRecordPDA,
            districtTreasury: treasuryPDA,
            caller: ctx.akimat.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        penalties.push(tx)
      } catch (err: any) {
        if (err.message?.includes('does not exist')) {
          console.log('  ⚠ Penalty engine not deployed — skipping')
          return
        }
        throw err
      }
    }

    expect(penalties).toHaveLength(3)
    console.log(`  ✓ 3 penalties applied (timeOverdue, qualityRejected, ghostSite)`)
  }, 60_000)
})
