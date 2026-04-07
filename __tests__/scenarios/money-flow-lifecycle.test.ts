import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/ownsContract', () => ({ ownsContract: vi.fn().mockReturnValue(true) }))
vi.mock('@/lib/adl-token', () => ({
  mintAdlTo: vi.fn().mockResolvedValue('mock-sig'),
  isAdlConfigured: vi.fn().mockReturnValue(true),
}))

const { POST: ContractPOST } = await import('@/app/api/contracts/route')
const { POST: SubmitPOST } = await import(
  '@/app/api/contracts/[id]/milestones/[milestoneId]/submit/route'
)
const { POST: JuryPOST, PATCH: JuryPATCH } = await import('@/app/api/jury/route')
const { POST: PenaltyPOST } = await import('@/app/api/contracts/[id]/penalty/route')
const { POST: TreasuryProposalPOST, PATCH: TreasuryVotePATCH } = await import(
  '@/app/api/treasury/[district]/route'
)
const { POST: TokenPOST } = await import('@/app/api/tokens/award/route')

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                      */
/* ------------------------------------------------------------------ */

function akimatHeaders(): HeadersInit {
  const token = Buffer.from(
    JSON.stringify({ role: 'AKIMAT', id: 'akimat-1' }),
  ).toString('base64')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

function contractorHeaders(): HeadersInit {
  const token = Buffer.from(
    JSON.stringify({ role: 'CONTRACTOR', id: 'demo-contractor-1' }),
  ).toString('base64')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

const JUROR_WALLET = '3zuYfqNAXFy8RYYSo6guiXXRPNc1hTvw7CFiLUnXoQWp'

function citizenHeaders(): HeadersInit {
  const token = Buffer.from(
    JSON.stringify({ role: 'CITIZEN', id: JUROR_WALLET }),
  ).toString('base64')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

/* ------------------------------------------------------------------ */
/*  Shared constants                                                  */
/* ------------------------------------------------------------------ */

const TOTAL = 100_000_000
const ESCROW = Math.floor(TOTAL * 0.2) // 20_000_000

/* ------------------------------------------------------------------ */
/*  D1: Full Contract Lifecycle with Money Flow                       */
/* ------------------------------------------------------------------ */

describe('D1: Full Contract Lifecycle', () => {
  beforeEach(() => {
    resetPrismaMock()
  })

  // Step 1 -------------------------------------------------------
  it('Step 1: Akimat registers a 100M tenge contract', async () => {
    // Contractor does not exist yet
    prismaMock.contractor.findFirst.mockResolvedValue(null)
    prismaMock.contractor.create.mockResolvedValue({
      id: 'contractor-1',
      name: 'ТОО СтройАлматы',
    })

    const createdContract = {
      id: 'c1',
      title: 'Ремонт дороги',
      district: 'Ауэзовский',
      totalAmount: BigInt(TOTAL),
      escrowAmount: BigInt(ESCROW),
      penaltyAmount: BigInt(0),
      status: 'ACTIVE',
      contractorId: 'contractor-1',
      onChainPubkey: 'pubkey123',
      contractor: { id: 'contractor-1', name: 'ТОО СтройАлматы' },
      milestones: [
        { id: 'm1', description: 'Этап 1', tranchePct: 30, sortOrder: 1, status: 'PENDING' },
        { id: 'm2', description: 'Этап 2', tranchePct: 30, sortOrder: 2, status: 'PENDING' },
        { id: 'm3', description: 'Этап 3', tranchePct: 40, sortOrder: 3, status: 'PENDING' },
      ],
    }
    prismaMock.contract.create.mockResolvedValue(createdContract)

    const req = new NextRequest('http://localhost/api/contracts', {
      method: 'POST',
      headers: akimatHeaders(),
      body: JSON.stringify({
        title: 'Ремонт дороги',
        description: 'Капитальный ремонт',
        district: 'Ауэзовский',
        lat: 43.23,
        lng: 76.94,
        contractorName: 'ТОО СтройАлматы',
        totalAmount: TOTAL,
        deadline: '2027-01-01',
        category: 'road',
        onChainPubkey: 'pubkey123',
        milestones: [
          { description: 'Этап 1', deadlineDays: 30, tranchePct: 30 },
          { description: 'Этап 2', deadlineDays: 60, tranchePct: 30 },
          { description: 'Этап 3', deadlineDays: 90, tranchePct: 40 },
        ],
      }),
    })

    const res = await ContractPOST(req)
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.escrowAmount).toBe(String(ESCROW))
    expect(Number(data.escrowAmount)).toBe(20_000_000)

    // Verify contractor was created since findFirst returned null
    expect(prismaMock.contractor.create).toHaveBeenCalled()
    // Verify contract.create was called with correct escrow calculation
    expect(prismaMock.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: BigInt(TOTAL),
          escrowAmount: BigInt(ESCROW),
        }),
      }),
    )
  })

  // Step 2 -------------------------------------------------------
  it('Step 2: Contractor submits milestone 1', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'c1',
      contractorId: 'demo-contractor-1',
      district: 'Ауэзовский',
      contractor: { name: 'ТОО СтройАлматы', walletAddress: null },
      milestones: [
        { id: 'm1', status: 'PENDING', description: 'Этап 1', sortOrder: 1, tranchePct: 30 },
        { id: 'm2', status: 'PENDING', description: 'Этап 2', sortOrder: 2, tranchePct: 30 },
        { id: 'm3', status: 'PENDING', description: 'Этап 3', sortOrder: 3, tranchePct: 40 },
      ],
    })

    // 3+ citizens available for jury
    prismaMock.citizen.findMany.mockResolvedValue([
      { id: 'juror-1' },
      { id: 'juror-2' },
      { id: 'juror-3' },
    ])

    // No stale jury sessions
    prismaMock.jurySession.findMany.mockResolvedValue([])

    // $transaction callback results
    prismaMock.milestone.update.mockResolvedValue({
      id: 'm1',
      status: 'UNDER_REVIEW',
    })
    prismaMock.jurySession.create.mockResolvedValue({
      id: 'sess-1',
      contractId: 'c1',
      milestoneId: 'm1',
      status: 'COMMIT_PHASE',
      votes: [
        { id: 'v1', citizenId: 'juror-1', isExpert: true, weight: 2 },
        { id: 'v2', citizenId: 'juror-2', isExpert: false, weight: 1 },
        { id: 'v3', citizenId: 'juror-3', isExpert: false, weight: 1 },
      ],
    })
    prismaMock.workLog.create.mockResolvedValue({ id: 'wl-1' })

    const req = new NextRequest(
      'http://localhost/api/contracts/c1/milestones/m1/submit',
      {
        method: 'POST',
        headers: contractorHeaders(),
        body: JSON.stringify({ photoHashes: ['QmHash1'], evidenceNote: 'Photos attached' }),
      },
    )

    const res = await SubmitPOST(req, {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.session.status).toBe('COMMIT_PHASE')
    expect(data.milestone.status).toBe('UNDER_REVIEW')
  })

  // Step 3 -------------------------------------------------------
  it('Step 3: Jury votes to ACCEPT milestone 1', async () => {
    const vote = 'accept'
    const salt = 'jury-salt-step3'
    const commitHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')

    const sess1Row = {
      id: 'sess-1',
      status: 'COMMIT_PHASE' as const,
      commitDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      revealDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
      contractId: 'contract-100m',
      milestoneId: 'm1',
      contract: { id: 'contract-100m', title: 'T', district: 'D', onChainPubkey: null as string | null },
      milestone: { id: 'm1', description: 'Этап 1' },
      votes: [] as unknown[],
    }

    // --- COMMIT phase ---
    // citizen.findUnique handles both wallet auth and eligibility lookups
    prismaMock.citizen.findUnique.mockImplementation((args: any) => {
      if (args?.where?.walletAddress) return Promise.resolve({ id: 'juror-1' })
      if (args?.where?.id) return Promise.resolve({ id: 'juror-1', isEligible: true, banUntil: null })
      return Promise.resolve(null)
    })
    prismaMock.jurySession.findUnique.mockResolvedValue(sess1Row)
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1',
      sessionId: 'sess-1',
      citizenId: 'juror-1',
      commitHash: null,
      revealedVote: null,
      weight: 1,
    })
    prismaMock.juryVote.update.mockResolvedValue({
      id: 'v1',
      commitHash,
    })

    const commitReq = new NextRequest('http://localhost/api/jury', {
      method: 'POST',
      headers: citizenHeaders(),
      body: JSON.stringify({ sessionId: 'sess-1', commitHash }),
    })

    const commitRes = await JuryPOST(commitReq)
    expect(commitRes.status).toBe(200)

    // --- REVEAL phase ---
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1',
      sessionId: 'sess-1',
      citizenId: 'juror-1',
      commitHash,
      revealedVote: null,
      weight: 1,
    })
    prismaMock.juryVote.update.mockResolvedValue({
      id: 'v1',
      revealedVote: 'ACCEPT',
      revealedSalt: salt,
    })
    prismaMock.juryVote.findUnique.mockResolvedValue({ id: 'v1', revealedVote: 'ACCEPT' })

    // After reveal, tally: 1 ACCEPT vote (weight 1) → weightedAccept(1) > weightedReject(0) → ACCEPT
    prismaMock.juryVote.findMany.mockResolvedValue([
      { revealedVote: 'ACCEPT', weight: 1 },
    ])
    // First call: resolveSessionForMutation; second call: sessionMeta
    prismaMock.jurySession.findUnique
      .mockResolvedValueOnce(sess1Row)
      .mockResolvedValueOnce({
        status: 'COMMIT_PHASE',
        milestoneId: 'm1',
        contractId: 'contract-100m',
      })
    prismaMock.jurySession.update.mockResolvedValue({ id: 'sess-1', status: 'FINALIZED' })
    prismaMock.milestone.update.mockResolvedValue({ id: 'm1', status: 'ACCEPTED', tranchePct: 30 })
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'contract-100m', totalAmount: BigInt(100_000_000), escrowAmount: BigInt(20_000_000), paidAmount: BigInt(0),
      milestones: [{ id: 'm1', status: 'ACCEPTED' }, { id: 'm2', status: 'PENDING' }],
    })
    prismaMock.contract.update.mockResolvedValue({
      id: 'contract-100m', escrowAmount: BigInt(20_000_000 - 30_000_000), paidAmount: BigInt(30_000_000),
    })

    const revealReq = new NextRequest('http://localhost/api/jury', {
      method: 'PATCH',
      headers: citizenHeaders(),
      body: JSON.stringify({ sessionId: 'sess-1', vote, salt }),
    })

    const revealRes = await JuryPATCH(revealReq)
    expect(revealRes.status).toBe(200)

    // Verify session was finalized as ACCEPT
    expect(prismaMock.jurySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-1' },
        data: expect.objectContaining({
          status: 'FINALIZED',
          result: 'ACCEPT',
        }),
      }),
    )
    // Verify milestone was marked ACCEPTED
    expect(prismaMock.milestone.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: { status: 'ACCEPTED' },
      }),
    )
    // Verify contractor payment was processed
    expect(prismaMock.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: { increment: BigInt(30_000_000) },
          escrowAmount: { decrement: BigInt(30_000_000) },
        }),
      }),
    )
    const revealData = await revealRes.json()
    expect(revealData.payment).toBeDefined()
    expect(revealData.payment.amount).toBe('30000000')
  })

  // Step 4 -------------------------------------------------------
  it('Step 4: Jury REJECTS milestone 2', async () => {
    const vote = 'reject'
    const salt = 'jury-salt-step4'
    const commitHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')

    const sess2Row = {
      id: 'sess-2',
      status: 'COMMIT_PHASE' as const,
      commitDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      revealDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
      contractId: 'contract-100m',
      milestoneId: 'm2',
      contract: { id: 'contract-100m', title: 'T', district: 'D', onChainPubkey: null as string | null },
      milestone: { id: 'm2', description: 'Этап 2' },
      votes: [] as unknown[],
    }

    // --- COMMIT ---
    prismaMock.citizen.findUnique.mockImplementation((args: any) => {
      if (args?.where?.walletAddress) return Promise.resolve({ id: 'juror-1' })
      if (args?.where?.id) return Promise.resolve({ id: 'juror-1', isEligible: true, banUntil: null })
      return Promise.resolve(null)
    })
    prismaMock.jurySession.findUnique.mockResolvedValue(sess2Row)
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v4',
      sessionId: 'sess-2',
      citizenId: 'juror-1',
      commitHash: null,
      revealedVote: null,
      weight: 1,
    })
    prismaMock.juryVote.update.mockResolvedValue({ id: 'v4', commitHash })

    const commitReq = new NextRequest('http://localhost/api/jury', {
      method: 'POST',
      headers: citizenHeaders(),
      body: JSON.stringify({ sessionId: 'sess-2', commitHash }),
    })
    const commitRes = await JuryPOST(commitReq)
    expect(commitRes.status).toBe(200)

    // --- REVEAL with all votes revealed as REJECT ---
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v4',
      sessionId: 'sess-2',
      citizenId: 'juror-1',
      commitHash,
      revealedVote: null,
      weight: 1,
    })
    prismaMock.juryVote.update.mockResolvedValue({
      id: 'v4',
      revealedVote: 'REJECT',
      revealedSalt: salt,
    })
    prismaMock.juryVote.findUnique.mockResolvedValue({ id: 'v4', revealedVote: 'REJECT' })

    // All 3 jurors rejected — weightedAccept = 0, weightedReject = 4 → REJECT
    prismaMock.juryVote.findMany.mockResolvedValue([
      { revealedVote: 'REJECT', weight: 2 },
      { revealedVote: 'REJECT', weight: 1 },
      { revealedVote: 'REJECT', weight: 1 },
    ])

    // First call: resolveSessionForMutation; second call: sessionMeta
    prismaMock.jurySession.findUnique
      .mockResolvedValueOnce(sess2Row)
      .mockResolvedValueOnce({
        status: 'COMMIT_PHASE',
        milestoneId: 'm2',
        contractId: 'contract-100m',
      })
    prismaMock.jurySession.update.mockResolvedValue({ id: 'sess-2', status: 'FINALIZED' })
    prismaMock.milestone.update.mockResolvedValue({ id: 'm2', status: 'REJECTED' })

    const revealReq = new NextRequest('http://localhost/api/jury', {
      method: 'PATCH',
      headers: citizenHeaders(),
      body: JSON.stringify({ sessionId: 'sess-2', vote, salt }),
    })

    const revealRes = await JuryPATCH(revealReq)
    expect(revealRes.status).toBe(200)

    expect(prismaMock.jurySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-2' },
        data: expect.objectContaining({
          status: 'FINALIZED',
          result: 'REJECT',
        }),
      }),
    )
    expect(prismaMock.milestone.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm2' },
        data: { status: 'REJECTED' },
      }),
    )
  })

  // Step 5 -------------------------------------------------------
  it('Step 5: TIME_OVERDUE penalty — 5 days = 5M tenge', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'c1',
      totalAmount: BigInt(TOTAL),
      penaltyAmount: BigInt(0),
      district: 'Ауэзовский',
      penalties: [], // no existing penalties
    })
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: BigInt(0) })
      // Second call after $transaction to get updated balance
      .mockResolvedValueOnce({ id: 'treasury-1', balance: BigInt(5_000_000) })

    // $transaction returns array of [penalty, treasury, contract]
    const penaltyAmount = BigInt(5_000_000) // 100M * 0.01 * 5
    prismaMock.penalty.create.mockResolvedValue({
      id: 'p1',
      contractId: 'c1',
      type: 'TIME_OVERDUE',
      amountTenge: penaltyAmount,
      daysOverdue: 5,
    })
    prismaMock.districtTreasury.update.mockResolvedValue({
      id: 'treasury-1',
      balance: BigInt(5_000_000),
    })
    prismaMock.contract.update.mockResolvedValue({
      id: 'c1',
      penaltyAmount: penaltyAmount,
    })

    const req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'TIME_OVERDUE',
        daysOverdue: 5,
        triggeredBy: 'akimat-1',
      }),
    })

    const res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(Number(data.penalty.amountTenge)).toBe(5_000_000)
    expect(Number(data.treasuryBalance)).toBe(5_000_000)
    expect(data.capped).toBe(false)
  })

  // Step 6 -------------------------------------------------------
  it('Step 6: QUALITY_REJECTED penalty — 1 rejection = 10M tenge', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'c1',
      totalAmount: BigInt(TOTAL),
      penaltyAmount: BigInt(5_000_000),
      district: 'Ауэзовский',
      penalties: [{ amountTenge: BigInt(5_000_000) }], // existing 5M from step 5
    })
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: BigInt(5_000_000) })
      .mockResolvedValueOnce({ id: 'treasury-1', balance: BigInt(15_000_000) })

    const penaltyAmount = BigInt(10_000_000) // 100M * 0.10 * 1
    prismaMock.penalty.create.mockResolvedValue({
      id: 'p2',
      contractId: 'c1',
      type: 'QUALITY_REJECTED',
      amountTenge: penaltyAmount,
    })
    prismaMock.districtTreasury.update.mockResolvedValue({
      id: 'treasury-1',
      balance: BigInt(15_000_000),
    })
    prismaMock.contract.update.mockResolvedValue({
      id: 'c1',
      penaltyAmount: BigInt(15_000_000),
    })

    const req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'QUALITY_REJECTED',
        rejectionCount: 1,
        triggeredBy: 'akimat-1',
      }),
    })

    const res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(Number(data.penalty.amountTenge)).toBe(10_000_000)
    expect(Number(data.treasuryBalance)).toBe(15_000_000)
    expect(Number(data.contractPenaltyTotal)).toBe(15_000_000)
    expect(data.capped).toBe(false)
  })

  // Step 7 -------------------------------------------------------
  it('Step 7: Hit penalty cap (30%) — raw 20M capped to 15M', async () => {
    // Existing penalties sum to 15M, cap is 30M (30% of 100M)
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'c1',
      totalAmount: BigInt(TOTAL),
      penaltyAmount: BigInt(15_000_000),
      district: 'Ауэзовский',
      penalties: [
        { amountTenge: BigInt(5_000_000) },
        { amountTenge: BigInt(10_000_000) },
      ],
    })
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: BigInt(15_000_000) })
      .mockResolvedValueOnce({ id: 'treasury-1', balance: BigInt(30_000_000) })

    // Raw = 100M * 0.01 * 20 = 20M, but cap = 30M - 15M existing = 15M actual
    const actualPenalty = BigInt(15_000_000)
    prismaMock.penalty.create.mockResolvedValue({
      id: 'p3',
      contractId: 'c1',
      type: 'TIME_OVERDUE',
      amountTenge: actualPenalty,
      daysOverdue: 20,
    })
    prismaMock.districtTreasury.update.mockResolvedValue({
      id: 'treasury-1',
      balance: BigInt(30_000_000),
    })
    prismaMock.contract.update.mockResolvedValue({
      id: 'c1',
      penaltyAmount: BigInt(30_000_000),
      status: 'PENALIZED',
    })

    const req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'TIME_OVERDUE',
        daysOverdue: 20,
        triggeredBy: 'akimat-1',
      }),
    })

    const res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(201)

    const data = await res.json()
    // Actual penalty is 15M (capped from 20M)
    expect(Number(data.penalty.amountTenge)).toBe(15_000_000)
    expect(data.capped).toBe(true)

    // Verify contract status was set to PENALIZED
    expect(prismaMock.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENALIZED',
        }),
      }),
    )
  })

  // Step 8 -------------------------------------------------------
  it('Step 8: Cap already reached — returns 409', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'c1',
      totalAmount: BigInt(TOTAL),
      penaltyAmount: BigInt(30_000_000),
      district: 'Ауэзовский',
      penalties: [
        { amountTenge: BigInt(5_000_000) },
        { amountTenge: BigInt(10_000_000) },
        { amountTenge: BigInt(15_000_000) },
      ],
    })

    const req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'TIME_OVERDUE',
        daysOverdue: 1,
        triggeredBy: 'akimat-1',
      }),
    })

    const res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(409)

    const data = await res.json()
    expect(data.error).toContain('cap already reached')
    expect(data.maxPenalty).toBe(30_000_000)
    expect(data.existingPenaltyTotal).toBe(30_000_000)
  })

  // Step 9 -------------------------------------------------------
  it('Step 9: Citizens create a treasury proposal', async () => {
    prismaMock.districtTreasury.findUnique.mockResolvedValue({
      id: 'treasury-1',
      district: 'Ауэзовский',
      balance: BigInt(30_000_000),
    })

    prismaMock.spendingProposal.create.mockResolvedValue({
      id: 'prop-1',
      treasuryId: 'treasury-1',
      title: 'Ремонт детской площадки',
      description: 'Использовать штрафные средства для ремонта',
      amount: BigInt(10_000_000),
      category: 'infrastructure',
      status: 'VOTING',
      votesFor: 0,
      votesAgainst: 0,
      votingEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })

    const req = new NextRequest(
      'http://localhost/api/treasury/%D0%90%D1%83%D1%8D%D0%B7%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9',
      {
        method: 'POST',
        headers: citizenHeaders(),
        body: JSON.stringify({
          title: 'Ремонт детской площадки',
          description: 'Использовать штрафные средства для ремонта',
          amount: 10_000_000,
          category: 'infrastructure',
        }),
      },
    )

    const res = await TreasuryProposalPOST(req, {
      params: Promise.resolve({ district: 'Ауэзовский' }),
    })
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.status).toBe('VOTING')
    expect(data.treasuryId).toBe('treasury-1')
  })

  // Step 10 ------------------------------------------------------
  it('Step 10: Citizens vote on a proposal', async () => {
    // No duplicate vote
    prismaMock.proposalVote.findUnique.mockResolvedValue(null)

    prismaMock.proposalVote.create.mockResolvedValue({
      id: 'vote-1',
      proposalId: 'prop-1',
      citizenId: 'citizen-voter-1',
      inFavor: true,
    })
    prismaMock.spendingProposal.update.mockResolvedValue({
      id: 'prop-1',
      votesFor: 1,
      votesAgainst: 0,
    })

    const req = new NextRequest(
      'http://localhost/api/treasury/%D0%90%D1%83%D1%8D%D0%B7%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9',
      {
        method: 'PATCH',
        headers: citizenHeaders(),
        body: JSON.stringify({
          proposalId: 'prop-1',
          citizenId: 'citizen-voter-1',
          inFavor: true,
          txSignature: 'tx-sig-vote-1',
        }),
      },
    )

    const res = await TreasuryVotePATCH(req, {
      params: Promise.resolve({ district: 'Ауэзовский' }),
    })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.vote.inFavor).toBe(true)
    expect(data.proposal.votesFor).toBe(1)
  })
})

/* ------------------------------------------------------------------ */
/*  D2: Penalty Cascade Math                                          */
/* ------------------------------------------------------------------ */

describe('D2: Penalty calculations', () => {
  beforeEach(() => {
    resetPrismaMock()
  })

  function setupPenaltyMocks(opts: {
    existingPenalties: number[]
    treasuryBalance?: number
  }) {
    const existingTotal = opts.existingPenalties.reduce((s, a) => s + a, 0)
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'c1',
      totalAmount: BigInt(TOTAL),
      penaltyAmount: BigInt(existingTotal),
      district: 'Ауэзовский',
      penalties: opts.existingPenalties.map((a, i) => ({
        id: `p-exist-${i}`,
        amountTenge: BigInt(a),
      })),
    })

    const initialBalance = BigInt(opts.treasuryBalance ?? existingTotal)
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: initialBalance })

    prismaMock.penalty.create.mockImplementation(async (args: any) => ({
      id: 'p-new',
      contractId: 'c1',
      type: args.data.type,
      amountTenge: args.data.amountTenge,
    }))
    prismaMock.districtTreasury.update.mockImplementation(async () => ({
      id: 'treasury-1',
    }))
    prismaMock.contract.update.mockImplementation(async (args: any) => ({
      id: 'c1',
      penaltyAmount: args.data.penaltyAmount?.increment
        ? BigInt(existingTotal) + args.data.penaltyAmount.increment
        : BigInt(existingTotal),
    }))
  }

  it('TIME_OVERDUE: totalAmount * 0.01 * daysOverdue', async () => {
    const testCases = [
      { days: 1, expected: 1_000_000 },
      { days: 5, expected: 5_000_000 },
      { days: 10, expected: 10_000_000 },
      { days: 15, expected: 15_000_000 },
    ]

    for (const tc of testCases) {
      resetPrismaMock()
      setupPenaltyMocks({ existingPenalties: [] })
      // Need a second findUnique call for balance after transaction
      prismaMock.districtTreasury.findUnique.mockResolvedValueOnce({
        id: 'treasury-1',
        balance: BigInt(tc.expected),
      })

      const req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'TIME_OVERDUE', daysOverdue: tc.days }),
      })

      const res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
      expect(res.status).toBe(201)

      const data = await res.json()
      expect(Number(data.penalty.amountTenge)).toBe(tc.expected)
    }
  })

  it('QUALITY_REJECTED: totalAmount * 0.10 * rejectionCount', async () => {
    const testCases = [
      { count: 1, expected: 10_000_000 },
      { count: 2, expected: 20_000_000 },
      { count: 3, expected: 30_000_000 }, // hits 30% cap exactly
    ]

    for (const tc of testCases) {
      resetPrismaMock()
      setupPenaltyMocks({ existingPenalties: [] })
      prismaMock.districtTreasury.findUnique.mockResolvedValueOnce({
        id: 'treasury-1',
        balance: BigInt(tc.expected),
      })

      const req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'QUALITY_REJECTED', rejectionCount: tc.count }),
      })

      const res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
      expect(res.status).toBe(201)

      const data = await res.json()
      expect(Number(data.penalty.amountTenge)).toBe(tc.expected)
    }
  })

  it('GHOST_SITE: totalAmount * 0.05 * ghostCount', async () => {
    const testCases = [
      { count: 1, expected: 5_000_000 },
      { count: 2, expected: 10_000_000 },
      { count: 4, expected: 20_000_000 },
    ]

    for (const tc of testCases) {
      resetPrismaMock()
      setupPenaltyMocks({ existingPenalties: [] })
      prismaMock.districtTreasury.findUnique.mockResolvedValueOnce({
        id: 'treasury-1',
        balance: BigInt(tc.expected),
      })

      const req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'GHOST_SITE', ghostCount: tc.count }),
      })

      const res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
      expect(res.status).toBe(201)

      const data = await res.json()
      expect(Number(data.penalty.amountTenge)).toBe(tc.expected)
    }
  })

  it('Cap enforcement: existing + new > 30% is capped', async () => {
    // Existing 25M, raw new = 10M, cap = 30M → actual = 5M
    resetPrismaMock()
    setupPenaltyMocks({ existingPenalties: [25_000_000] })
    prismaMock.districtTreasury.findUnique.mockResolvedValueOnce({
      id: 'treasury-1',
      balance: BigInt(30_000_000),
    })

    const req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'QUALITY_REJECTED', rejectionCount: 1 }),
    })

    const res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(Number(data.penalty.amountTenge)).toBe(5_000_000)
    expect(data.capped).toBe(true)
  })

  it('Multiple penalty types stack correctly', async () => {
    // Step A: TIME_OVERDUE 10 days = 10M
    resetPrismaMock()
    setupPenaltyMocks({ existingPenalties: [] })
    prismaMock.districtTreasury.findUnique.mockResolvedValueOnce({
      id: 'treasury-1',
      balance: BigInt(10_000_000),
    })

    let req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'TIME_OVERDUE', daysOverdue: 10 }),
    })
    let res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(201)
    let data = await res.json()
    expect(Number(data.penalty.amountTenge)).toBe(10_000_000)

    // Step B: QUALITY_REJECTED 1x on top of 10M existing = 10M more
    resetPrismaMock()
    setupPenaltyMocks({ existingPenalties: [10_000_000] })
    prismaMock.districtTreasury.findUnique.mockResolvedValueOnce({
      id: 'treasury-1',
      balance: BigInt(20_000_000),
    })

    req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'QUALITY_REJECTED', rejectionCount: 1 }),
    })
    res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(201)
    data = await res.json()
    expect(Number(data.penalty.amountTenge)).toBe(10_000_000)

    // Step C: GHOST_SITE 2x on top of 20M existing = 10M raw but capped to 10M (30M cap - 20M)
    resetPrismaMock()
    setupPenaltyMocks({ existingPenalties: [10_000_000, 10_000_000] })
    prismaMock.districtTreasury.findUnique.mockResolvedValueOnce({
      id: 'treasury-1',
      balance: BigInt(30_000_000),
    })

    req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'GHOST_SITE', ghostCount: 2 }),
    })
    res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(201)
    data = await res.json()
    expect(Number(data.penalty.amountTenge)).toBe(10_000_000)
    expect(data.capped).toBe(true)

    // Step D: Any further penalty → 409
    resetPrismaMock()
    setupPenaltyMocks({ existingPenalties: [10_000_000, 10_000_000, 10_000_000] })

    req = new NextRequest('http://localhost/api/contracts/c1/penalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'TIME_OVERDUE', daysOverdue: 1 }),
    })
    res = await PenaltyPOST(req, { params: Promise.resolve({ id: 'c1' }) })
    expect(res.status).toBe(409)
  })
})

/* ------------------------------------------------------------------ */
/*  D3: Token Reward Flow                                             */
/* ------------------------------------------------------------------ */

describe('D3: Token rewards across lifecycle', () => {
  beforeEach(() => {
    resetPrismaMock()
  })

  const WALLET = '3zuYfqNAXFy8RYYSo6guiXXRPNc1hTvw7CFiLUnXoQWp'

  async function awardAction(action: string): Promise<{ ok: boolean; amount: number }> {
    const req = new NextRequest('http://localhost/api/tokens/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, walletAddress: WALLET }),
    })
    const res = await TokenPOST(req)
    expect(res.status).toBe(200)
    return res.json()
  }

  it('registration rewards 100 ADL', async () => {
    const data = await awardAction('registration')
    expect(data.ok).toBe(true)
    expect(data.amount).toBe(100)
  })

  it('jury_vote (commit) rewards 25 ADL', async () => {
    const data = await awardAction('jury_vote')
    expect(data.ok).toBe(true)
    expect(data.amount).toBe(25)
  })

  it('jury_reveal rewards 25 ADL', async () => {
    const data = await awardAction('jury_reveal')
    expect(data.ok).toBe(true)
    expect(data.amount).toBe(25)
  })

  it('treasury_vote rewards 20 ADL', async () => {
    const data = await awardAction('treasury_vote')
    expect(data.ok).toBe(true)
    expect(data.amount).toBe(20)
  })

  it('crowdfunding_donation rewards 15 ADL', async () => {
    const data = await awardAction('crowdfunding_donation')
    expect(data.ok).toBe(true)
    expect(data.amount).toBe(15)
  })

  it('total lifecycle rewards = 185 ADL', async () => {
    const actions: { action: string; expected: number }[] = [
      { action: 'registration', expected: 100 },
      { action: 'jury_vote', expected: 25 },
      { action: 'jury_reveal', expected: 25 },
      { action: 'treasury_vote', expected: 20 },
      { action: 'crowdfunding_donation', expected: 15 },
    ]

    let total = 0
    for (const { action, expected } of actions) {
      const data = await awardAction(action)
      expect(data.amount).toBe(expected)
      total += data.amount
    }

    expect(total).toBe(185)
  })

  it('rejects invalid action', async () => {
    const req = new NextRequest('http://localhost/api/tokens/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'nonexistent', walletAddress: WALLET }),
    })
    const res = await TokenPOST(req)
    expect(res.status).toBe(400)
  })

  it('rejects missing walletAddress', async () => {
    const req = new NextRequest('http://localhost/api/tokens/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'registration' }),
    })
    const res = await TokenPOST(req)
    expect(res.status).toBe(400)
  })
})
