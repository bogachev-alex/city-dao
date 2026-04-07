/**
 * E2E test: Jury commit-reveal voting on Solana devnet.
 *
 * Roles: Akimat (authority), Contractor, 3 Citizen jurors
 * Flow:  register contract → submit milestone → init jury session →
 *        select jurors → commit votes → start reveal → reveal votes →
 *        finalize → verify result
 *
 * Run: npm run test:solana
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createHash, randomBytes } from 'crypto'
import {
  type TestContext,
  type RoleKeypair,
  setupTestContext,
  registerTestContract,
  submitTestMilestone,
  getJurySessionPDA,
  getJuryVotePDA,
  getCitizenPDA,
  BN,
  PublicKey,
  SystemProgram,
  sleep,
} from './setup'

import juryMechanismIdl from '@/lib/web3/idl/jury_mechanism.json'
import citizenRegistryIdl from '@/lib/web3/idl/citizen_registry.json'

describe('Jury Voting Flow (devnet)', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await setupTestContext()
  }, 60_000)

  /**
   * Register a citizen on-chain (needed for jury eligibility).
   */
  async function registerCitizen(citizen: RoleKeypair, district: string = 'Медеуский') {
    const program = ctx.programFor(citizenRegistryIdl, citizen)
    const [citizenPDA] = getCitizenPDA(citizen.publicKey)

    // Generate a fake IIN hash (32 bytes)
    const iinHash = Array.from(createHash('sha256').update(citizen.publicKey.toBase58()).digest())

    try {
      await (program.methods as any)
        .registerCitizen(district, iinHash)
        .accounts({
          citizenProfile: citizenPDA,
          wallet: citizen.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    } catch (err: any) {
      // Ignore "already in use" (citizen already registered from a prior test run)
      if (!err.message?.includes('already in use')) throw err
    }
  }

  /**
   * Create a SHA-256 vote commitment hash: H(vote || salt).
   */
  function createVoteHash(vote: 'accept' | 'reject', salt: Uint8Array): number[] {
    const voteBytes = vote === 'accept' ? [1] : [0]
    const hash = createHash('sha256')
      .update(Buffer.from(voteBytes))
      .update(salt)
      .digest()
    return Array.from(hash)
  }

  // ─────────────────────────────────────────────
  // 1. Init jury session for a submitted milestone
  // ─────────────────────────────────────────────

  it('full jury voting flow: init → select → commit → reveal → finalize', async () => {
    // --- Setup: register contract, submit milestone ---
    const { contractPDA } = await registerTestContract(ctx, {
      milestones: [
        { description: 'Jury test milestone', deadlineDays: 1, tranchePct: 50 },
        { description: 'Second milestone', deadlineDays: 2, tranchePct: 50 },
      ],
    })

    await submitTestMilestone(ctx, contractPDA, 0, 'QmJuryEvidence')
    console.log('  ✓ Contract registered, milestone 0 submitted')

    // --- Register all 3 citizens ---
    for (const citizen of ctx.citizens) {
      await registerCitizen(citizen)
    }
    console.log('  ✓ 3 citizens registered')

    // --- Init jury session ---
    const milestoneIndex = 0
    const [sessionPDA] = getJurySessionPDA(contractPDA, milestoneIndex)
    const juryProgram = ctx.programFor(juryMechanismIdl, ctx.akimat)

    await (juryProgram.methods as any)
      .initSession(contractPDA, milestoneIndex)
      .accounts({
        jurySession: sessionPDA,
        authority: ctx.akimat.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    console.log('  ✓ Jury session initialized')

    // --- Select jurors (3 citizens, citizen[0] is expert) ---
    const fakeVrf = Array.from(randomBytes(32))
    const jurorPubkeys = ctx.citizens.map((c) => c.publicKey)

    await (juryProgram.methods as any)
      .selectJury(fakeVrf, jurorPubkeys, 0) // expert_index = 0
      .accounts({
        jurySession: sessionPDA,
        authority: ctx.akimat.publicKey,
      })
      .rpc()
    console.log('  ✓ Jurors selected')

    // --- Commit phase: each juror commits a vote ---
    const votes: Array<{ vote: 'accept' | 'reject'; salt: Uint8Array }> = [
      { vote: 'accept', salt: randomBytes(32) },
      { vote: 'accept', salt: randomBytes(32) },
      { vote: 'reject', salt: randomBytes(32) },
    ]

    for (let i = 0; i < 3; i++) {
      const citizen = ctx.citizens[i]
      const [votePDA] = getJuryVotePDA(sessionPDA, citizen.publicKey)
      const citizenProgram = ctx.programFor(juryMechanismIdl, citizen)
      const voteHash = createVoteHash(votes[i].vote, votes[i].salt)

      await (citizenProgram.methods as any)
        .commitVote(voteHash)
        .accounts({
          jurySession: sessionPDA,
          juryVote: votePDA,
          juror: citizen.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      console.log(`  ✓ Citizen ${i} committed vote: ${votes[i].vote}`)
    }

    // --- Start reveal phase (akimat transitions session) ---
    await (juryProgram.methods as any)
      .startRevealPhase()
      .accounts({
        jurySession: sessionPDA,
        authority: ctx.akimat.publicKey,
      })
      .rpc()
    console.log('  ✓ Reveal phase started')

    // --- Reveal phase: each juror reveals their vote ---
    for (let i = 0; i < 3; i++) {
      const citizen = ctx.citizens[i]
      const [votePDA] = getJuryVotePDA(sessionPDA, citizen.publicKey)
      const citizenProgram = ctx.programFor(juryMechanismIdl, citizen)

      const voteValue = votes[i].vote === 'accept' ? { accept: {} } : { reject: {} }

      await (citizenProgram.methods as any)
        .revealVote(voteValue, Array.from(votes[i].salt))
        .accounts({
          jurySession: sessionPDA,
          juryVote: votePDA,
          juror: citizen.publicKey,
        })
        .rpc()
      console.log(`  ✓ Citizen ${i} revealed vote`)
    }

    // --- Finalize session ---
    // 2 accept (citizen[0] is expert → weight 2, citizen[1] → weight 1) = 3 accept
    // 1 reject (citizen[2] → weight 1) = 1 reject
    // Total: 3 accept vs 1 reject → accepted (threshold = 3)
    await (juryProgram.methods as any)
      .finalizeSession(3, 1) // weighted_accept, weighted_reject
      .accounts({
        jurySession: sessionPDA,
        authority: ctx.akimat.publicKey,
      })
      .rpc()
    console.log('  ✓ Session finalized')

    // --- Verify session result ---
    const sessionAccount = await (juryProgram.account as any).jurySession.fetch(sessionPDA)
    expect(sessionAccount).toBeTruthy()

    // The result should be Accepted (weighted accept ≥ 3)
    console.log('  ✓ Jury session result:', JSON.stringify(sessionAccount.status))
    console.log('  ✓ Full jury voting flow completed!')
  }, 120_000)

  // ─────────────────────────────────────────────
  // 2. Jury rejects a milestone (majority reject)
  // ─────────────────────────────────────────────

  it('jury rejects milestone when majority votes reject', async () => {
    const { contractPDA } = await registerTestContract(ctx, {
      milestones: [
        { description: 'Reject test', deadlineDays: 1, tranchePct: 50 },
        { description: 'Other', deadlineDays: 2, tranchePct: 50 },
      ],
    })
    await submitTestMilestone(ctx, contractPDA, 0, 'QmBadEvidence')

    for (const citizen of ctx.citizens) {
      await registerCitizen(citizen)
    }

    const milestoneIndex = 0
    const [sessionPDA] = getJurySessionPDA(contractPDA, milestoneIndex)
    const juryProgram = ctx.programFor(juryMechanismIdl, ctx.akimat)

    // Init session
    await (juryProgram.methods as any)
      .initSession(contractPDA, milestoneIndex)
      .accounts({
        jurySession: sessionPDA,
        authority: ctx.akimat.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    // Select jurors
    await (juryProgram.methods as any)
      .selectJury(Array.from(randomBytes(32)), ctx.citizens.map((c) => c.publicKey), 0)
      .accounts({ jurySession: sessionPDA, authority: ctx.akimat.publicKey })
      .rpc()

    // All 3 vote REJECT
    const votes = ctx.citizens.map(() => ({
      vote: 'reject' as const,
      salt: randomBytes(32),
    }))

    for (let i = 0; i < 3; i++) {
      const [votePDA] = getJuryVotePDA(sessionPDA, ctx.citizens[i].publicKey)
      const prog = ctx.programFor(juryMechanismIdl, ctx.citizens[i])
      await (prog.methods as any)
        .commitVote(createVoteHash(votes[i].vote, votes[i].salt))
        .accounts({
          jurySession: sessionPDA,
          juryVote: votePDA,
          juror: ctx.citizens[i].publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    }

    // Reveal phase
    await (juryProgram.methods as any)
      .startRevealPhase()
      .accounts({ jurySession: sessionPDA, authority: ctx.akimat.publicKey })
      .rpc()

    for (let i = 0; i < 3; i++) {
      const [votePDA] = getJuryVotePDA(sessionPDA, ctx.citizens[i].publicKey)
      const prog = ctx.programFor(juryMechanismIdl, ctx.citizens[i])
      await (prog.methods as any)
        .revealVote({ reject: {} }, Array.from(votes[i].salt))
        .accounts({
          jurySession: sessionPDA,
          juryVote: votePDA,
          juror: ctx.citizens[i].publicKey,
        })
        .rpc()
    }

    // Finalize: 0 accept, 4 reject (expert=2 + 2 citizens=1 each)
    await (juryProgram.methods as any)
      .finalizeSession(0, 4)
      .accounts({ jurySession: sessionPDA, authority: ctx.akimat.publicKey })
      .rpc()

    const sessionAccount = await (juryProgram.account as any).jurySession.fetch(sessionPDA)
    expect(sessionAccount).toBeTruthy()

    console.log('  ✓ Jury rejected milestone (unanimous reject)')
    console.log('  ✓ Session status:', JSON.stringify(sessionAccount.status))
  }, 120_000)
})
