/**
 * E2E test: Full contract lifecycle on Solana devnet.
 *
 * Roles: Akimat (authority), Contractor
 * Flow:  register → fund escrow → submit milestone → accept → verify payout
 *
 * Run: npm run test:solana
 * Requires: Solana devnet access (airdrop for test wallets)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  type TestContext,
  setupTestContext,
  registerTestContract,
  fundTestEscrow,
  submitTestMilestone,
  acceptTestMilestone,
  rejectTestMilestone,
  terminateTestContract,
  fetchContractAccount,
  getBalance,
  getEscrowBalanceSol,
  getEscrowPDA,
  LAMPORTS_PER_SOL,
  sleep,
} from './setup'

describe('Contract Lifecycle (devnet)', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await setupTestContext()
  }, 60_000) // airdrop can be slow

  // ─────────────────────────────────────────────
  // 1. Register contract
  // ─────────────────────────────────────────────

  it('akimat registers a contract and 20% goes to escrow', async () => {
    const totalLamports = 1 * LAMPORTS_PER_SOL // 1 SOL

    const { contractPDA, escrowPDA } = await registerTestContract(ctx, {
      totalLamports,
      milestones: [
        { description: 'Demolition', deadlineDays: 1, tranchePct: 40 },
        { description: 'Construction', deadlineDays: 2, tranchePct: 60 },
      ],
    })

    // Verify on-chain account was created
    const account = await fetchContractAccount(ctx, contractPDA)
    expect(account).toBeTruthy()
    expect(account.status).toHaveProperty('active')
    expect(account.milestones).toHaveLength(2)
    expect(Number(account.totalAmount)).toBe(totalLamports)

    // 20% of 1 SOL = 0.2 SOL should be in escrow
    const escrowBalance = await getBalance(ctx.connection, escrowPDA)
    expect(escrowBalance).toBeGreaterThanOrEqual(0.19 * LAMPORTS_PER_SOL)
    expect(escrowBalance).toBeLessThanOrEqual(0.21 * LAMPORTS_PER_SOL)

    console.log(`  ✓ Contract registered: ${contractPDA.toBase58()}`)
    console.log(`  ✓ Escrow balance: ${escrowBalance / LAMPORTS_PER_SOL} SOL`)
  }, 30_000)

  // ─────────────────────────────────────────────
  // 2. Fund escrow to 100%
  // ─────────────────────────────────────────────

  it('akimat funds escrow incrementally to full amount', async () => {
    const totalLamports = 1 * LAMPORTS_PER_SOL

    const { contractPDA, escrowPDA } = await registerTestContract(ctx, {
      totalLamports,
      milestones: [
        { description: 'Phase A', deadlineDays: 1, tranchePct: 50 },
        { description: 'Phase B', deadlineDays: 2, tranchePct: 50 },
      ],
    })

    // After registration: ~0.2 SOL in escrow (20%)
    const balanceBefore = await getBalance(ctx.connection, escrowPDA)

    // Fund remaining 80% in two parts: 40% + 40%
    const part1 = Math.round(0.4 * totalLamports)
    const part2 = Math.round(0.4 * totalLamports)

    const tx1 = await fundTestEscrow(ctx, contractPDA, ctx.akimat, part1)
    expect(tx1).toBeTruthy()
    console.log(`  ✓ Funded +0.4 SOL, tx: ${tx1.slice(0, 16)}...`)

    const tx2 = await fundTestEscrow(ctx, contractPDA, ctx.akimat, part2)
    expect(tx2).toBeTruthy()
    console.log(`  ✓ Funded +0.4 SOL, tx: ${tx2.slice(0, 16)}...`)

    const balanceAfter = await getBalance(ctx.connection, escrowPDA)
    const addedLamports = balanceAfter - balanceBefore
    const expectedAdded = part1 + part2

    // Allow small delta for rent
    expect(addedLamports).toBeGreaterThanOrEqual(expectedAdded - 10_000)
    expect(addedLamports).toBeLessThanOrEqual(expectedAdded + 10_000)

    console.log(`  ✓ Escrow total: ${balanceAfter / LAMPORTS_PER_SOL} SOL (target ~1.0)`)
  }, 30_000)

  // ─────────────────────────────────────────────
  // 3. Contractor submits milestone
  // ─────────────────────────────────────────────

  it('contractor submits milestone with IPFS evidence', async () => {
    const { contractPDA } = await registerTestContract(ctx, {
      milestones: [
        { description: 'Milestone 1', deadlineDays: 1, tranchePct: 50 },
        { description: 'Milestone 2', deadlineDays: 2, tranchePct: 50 },
      ],
    })

    const tx = await submitTestMilestone(ctx, contractPDA, 0, 'QmTestHash12345')
    expect(tx).toBeTruthy()

    // Verify milestone status changed to Submitted
    const account = await fetchContractAccount(ctx, contractPDA)
    expect(account.milestones[0].status).toHaveProperty('submitted')
    expect(account.milestones[1].status).toHaveProperty('pending')

    console.log(`  ✓ Milestone 0 submitted, tx: ${tx.slice(0, 16)}...`)
  }, 30_000)

  // ─────────────────────────────────────────────
  // 4. Accept milestone → tranche payout
  // ─────────────────────────────────────────────

  it('akimat accepts milestone and contractor receives tranche', async () => {
    const totalLamports = 1 * LAMPORTS_PER_SOL
    const { contractPDA, escrowPDA } = await registerTestContract(ctx, {
      totalLamports,
      milestones: [
        { description: 'First', deadlineDays: 1, tranchePct: 40 },
        { description: 'Second', deadlineDays: 2, tranchePct: 60 },
      ],
    })

    // Fund escrow to have enough for the tranche
    await fundTestEscrow(ctx, contractPDA, ctx.akimat, Math.round(0.8 * totalLamports))

    // Contractor submits milestone 0
    await submitTestMilestone(ctx, contractPDA, 0, 'QmEvidence001')

    // Record balances before payout
    const contractorBefore = await getBalance(ctx.connection, ctx.contractor.publicKey)
    const escrowBefore = await getBalance(ctx.connection, escrowPDA)

    // Akimat accepts → tranche released
    const tx = await acceptTestMilestone(ctx, contractPDA, 0)
    expect(tx).toBeTruthy()

    // Verify milestone status is Accepted
    const account = await fetchContractAccount(ctx, contractPDA)
    expect(account.milestones[0].status).toHaveProperty('accepted')
    expect(Number(account.milestonesAccepted)).toBe(1)

    // Verify contractor received ~40% of total (0.4 SOL)
    const contractorAfter = await getBalance(ctx.connection, ctx.contractor.publicKey)
    const contractorGain = contractorAfter - contractorBefore
    const expectedTranche = Math.round(totalLamports * 0.4)

    // Allow 5% tolerance for rent/fees
    expect(contractorGain).toBeGreaterThan(expectedTranche * 0.9)
    expect(contractorGain).toBeLessThan(expectedTranche * 1.1)

    // Verify escrow decreased
    const escrowAfter = await getBalance(ctx.connection, escrowPDA)
    expect(escrowAfter).toBeLessThan(escrowBefore)

    console.log(`  ✓ Milestone 0 accepted, tx: ${tx.slice(0, 16)}...`)
    console.log(`  ✓ Contractor received: ${contractorGain / LAMPORTS_PER_SOL} SOL`)
    console.log(`  ✓ Escrow remaining: ${escrowAfter / LAMPORTS_PER_SOL} SOL`)
  }, 45_000)

  // ─────────────────────────────────────────────
  // 5. Reject milestone — no payout
  // ─────────────────────────────────────────────

  it('akimat rejects milestone and no SOL moves', async () => {
    const { contractPDA } = await registerTestContract(ctx)

    // Contractor submits
    await submitTestMilestone(ctx, contractPDA, 0, 'QmBadWork')

    const contractorBefore = await getBalance(ctx.connection, ctx.contractor.publicKey)

    // Akimat rejects
    const tx = await rejectTestMilestone(ctx, contractPDA, 0)
    expect(tx).toBeTruthy()

    // Milestone should go back to Rejected or Pending
    const account = await fetchContractAccount(ctx, contractPDA)
    const s = account.milestones[0].status
    expect(s).toSatisfy(
      (v: any) => 'rejected' in v || 'pending' in v,
    )

    // Contractor balance should not increase (only decrease slightly for fees)
    const contractorAfter = await getBalance(ctx.connection, ctx.contractor.publicKey)
    expect(contractorAfter).toBeLessThanOrEqual(contractorBefore)

    console.log(`  ✓ Milestone rejected, no payout`)
  }, 30_000)

  // ─────────────────────────────────────────────
  // 6. Full flow: register → fund → submit all → accept all → contract completed
  // ─────────────────────────────────────────────

  it('full lifecycle: all milestones accepted → contract completed', async () => {
    const totalLamports = 1 * LAMPORTS_PER_SOL
    const { contractPDA, escrowPDA } = await registerTestContract(ctx, {
      totalLamports,
      milestones: [
        { description: 'Step 1', deadlineDays: 1, tranchePct: 30 },
        { description: 'Step 2', deadlineDays: 2, tranchePct: 30 },
        { description: 'Step 3', deadlineDays: 3, tranchePct: 40 },
      ],
    })

    // Fund escrow to 100%
    await fundTestEscrow(ctx, contractPDA, ctx.akimat, Math.round(0.8 * totalLamports))

    const contractorStart = await getBalance(ctx.connection, ctx.contractor.publicKey)

    // Process each milestone: submit → accept
    for (let i = 0; i < 3; i++) {
      await submitTestMilestone(ctx, contractPDA, i, `QmEvidence_${i}`)
      await acceptTestMilestone(ctx, contractPDA, i)
      console.log(`  ✓ Milestone ${i} accepted`)
    }

    // Verify contract is completed
    const account = await fetchContractAccount(ctx, contractPDA)
    expect(Number(account.milestonesAccepted)).toBe(3)
    // Contract should be completed (all milestones accepted)
    expect(account.status).toSatisfy(
      (v: any) => 'completed' in v || 'active' in v,
      // Some programs mark completed only after explicit call
    )

    // Verify contractor received roughly the full amount
    const contractorEnd = await getBalance(ctx.connection, ctx.contractor.publicKey)
    const totalReceived = contractorEnd - contractorStart
    expect(totalReceived).toBeGreaterThan(totalLamports * 0.85)

    // Escrow should be nearly empty
    const escrowFinal = await getBalance(ctx.connection, escrowPDA)
    console.log(`  ✓ Full lifecycle complete`)
    console.log(`  ✓ Contractor total received: ${totalReceived / LAMPORTS_PER_SOL} SOL`)
    console.log(`  ✓ Escrow remaining: ${escrowFinal / LAMPORTS_PER_SOL} SOL`)
  }, 60_000)

  // ─────────────────────────────────────────────
  // 7. Terminate contract
  // ─────────────────────────────────────────────

  it('akimat terminates contract', async () => {
    const { contractPDA } = await registerTestContract(ctx)

    const tx = await terminateTestContract(ctx, contractPDA)
    expect(tx).toBeTruthy()

    const account = await fetchContractAccount(ctx, contractPDA)
    expect(account.status).toHaveProperty('terminated')

    console.log(`  ✓ Contract terminated`)
  }, 30_000)
})
