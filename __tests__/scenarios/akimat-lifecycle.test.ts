import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/web3/verifyTransaction', () => ({
  verifyTransaction: vi.fn().mockResolvedValue({ valid: true }),
}))

// Treasury route depends on web3 modules that need Solana — stub them out
vi.mock('@/lib/web3/fetchDistrictTreasuryBalance', () => ({
  fetchDistrictTreasuryBalanceOnChain: vi.fn().mockResolvedValue(null),
  getReadOnlySolanaConnection: vi.fn(),
}))
vi.mock('@/lib/web3/pda', () => ({
  getTreasuryPDA: vi.fn().mockReturnValue([{ toBase58: () => 'fakePDA' }]),
}))
vi.mock('@/lib/demoTreasury', () => ({
  getDemoTreasury: vi.fn().mockReturnValue(null),
}))

// next/cache unstable_cache — pass through for test (execute fn immediately)
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn: Function) => fn),
  revalidateTag: vi.fn(),
}))

// Import route handlers AFTER mocks
const { POST: ContractPOST } = await import('@/app/api/contracts/route')
const { POST: PenaltyPOST } = await import('@/app/api/contracts/[id]/penalty/route')
const { POST: TreasuryPOST } = await import('@/app/api/treasury/[district]/route')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function akimatHeaders(): HeadersInit {
  const token = Buffer.from(
    JSON.stringify({ role: 'AKIMAT', id: 'demo-akimat-1' })
  ).toString('base64')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

function citizenHeaders(): HeadersInit {
  const token = Buffer.from(
    JSON.stringify({ role: 'CITIZEN', id: 'citizen-1' })
  ).toString('base64')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

const VALID_CONTRACT_BODY = {
  title: 'Ремонт дороги на ул. Абая',
  description: 'Капитальный ремонт асфальтового покрытия',
  district: 'Ауэзовский',
  lat: 43.238,
  lng: 76.946,
  contractorName: 'ТОО СтройМастер',
  totalAmount: 100_000_000,
  deadline: '2026-12-31',
  category: 'ROAD',
  onChainPubkey: 'Abc123OnChainPubkey',
  milestones: [
    { description: 'Демонтаж старого покрытия', deadlineDays: 30, tranchePct: 30 },
    { description: 'Укладка нового асфальта', deadlineDays: 60, tranchePct: 50 },
    { description: 'Финальная приёмка', deadlineDays: 90, tranchePct: 20 },
  ],
}

beforeEach(() => {
  resetPrismaMock()
})

// ===========================================================================
// A1. Contract Registration (POST /api/contracts)
// ===========================================================================

describe('A1. Contract Registration — POST /api/contracts', () => {
  it('successfully creates contract with milestones and escrow = 20% of totalAmount', async () => {
    const createdContract = {
      id: 'contract-1',
      title: VALID_CONTRACT_BODY.title,
      description: VALID_CONTRACT_BODY.description,
      district: VALID_CONTRACT_BODY.district,
      lat: VALID_CONTRACT_BODY.lat,
      lng: VALID_CONTRACT_BODY.lng,
      contractorId: 'contractor-1',
      totalAmount: BigInt(100_000_000),
      escrowAmount: BigInt(20_000_000), // 20%
      penaltyAmount: BigInt(0),
      deadline: new Date('2026-12-31'),
      category: 'ROAD',
      status: 'ACTIVE',
      onChainPubkey: 'Abc123OnChainPubkey',
      createdAt: new Date(),
      contractor: { id: 'contractor-1', name: 'ТОО СтройМастер' },
      milestones: [
        { id: 'm1', description: 'Демонтаж старого покрытия', deadlineDays: 30, tranchePct: 30, sortOrder: 1, status: 'PENDING' },
        { id: 'm2', description: 'Укладка нового асфальта', deadlineDays: 60, tranchePct: 50, sortOrder: 2, status: 'PENDING' },
        { id: 'm3', description: 'Финальная приёмка', deadlineDays: 90, tranchePct: 20, sortOrder: 3, status: 'PENDING' },
      ],
    }

    // find-or-create contractor: not found, so create
    prismaMock.contractor.findFirst.mockResolvedValue(null)
    prismaMock.contractor.create.mockResolvedValue({ id: 'contractor-1', name: 'ТОО СтройМастер' })
    prismaMock.contract.create.mockResolvedValue(createdContract)

    const res = await ContractPOST(
      new NextRequest('http://localhost/api/contracts', {
        method: 'POST',
        headers: akimatHeaders(),
        body: JSON.stringify(VALID_CONTRACT_BODY),
      })
    )

    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.title).toBe(VALID_CONTRACT_BODY.title)
    expect(json.district).toBe('Ауэзовский')
    // BigInt serialised to string by toJsonSafe
    expect(json.totalAmount).toBe('100000000')
    expect(json.escrowAmount).toBe('20000000')
    expect(json.milestones).toHaveLength(3)
    expect(json.contractor.name).toBe('ТОО СтройМастер')

    // Verify prisma was called with 20% escrow
    const createCall = prismaMock.contract.create.mock.calls[0][0]
    expect(createCall.data.escrowAmount).toBe(BigInt(20_000_000))
    expect(createCall.data.totalAmount).toBe(BigInt(100_000_000))
    expect(createCall.data.milestones.create).toHaveLength(3)
    expect(createCall.data.milestones.create[0].sortOrder).toBe(1)
    expect(createCall.data.milestones.create[2].sortOrder).toBe(3)
  })

  it('returns 400 when onChainPubkey is missing', async () => {
    const bodyNoKey = { ...VALID_CONTRACT_BODY, onChainPubkey: undefined }

    // Still need to resolve contractor first (route processes contractor before pubkey check)
    prismaMock.contractor.findFirst.mockResolvedValue(null)
    prismaMock.contractor.create.mockResolvedValue({ id: 'c-new', name: 'ТОО СтройМастер' })

    const res = await ContractPOST(
      new NextRequest('http://localhost/api/contracts', {
        method: 'POST',
        headers: akimatHeaders(),
        body: JSON.stringify(bodyNoKey),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('onChainPubkey')
  })

  it('returns 400 when neither contractorId nor contractorName is provided', async () => {
    const bodyNoContractor = {
      ...VALID_CONTRACT_BODY,
      contractorName: undefined,
      contractorId: undefined,
    }

    const res = await ContractPOST(
      new NextRequest('http://localhost/api/contracts', {
        method: 'POST',
        headers: akimatHeaders(),
        body: JSON.stringify(bodyNoContractor),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('contractorId')
  })

  it('finds existing contractor by contractorName instead of creating new one', async () => {
    const existingContractor = { id: 'existing-co', name: 'ТОО СтройМастер' }
    prismaMock.contractor.findFirst.mockResolvedValue(existingContractor)
    prismaMock.contract.create.mockResolvedValue({
      id: 'c-1',
      contractorId: 'existing-co',
      totalAmount: BigInt(100_000_000),
      escrowAmount: BigInt(20_000_000),
      contractor: existingContractor,
      milestones: [],
    })

    const res = await ContractPOST(
      new NextRequest('http://localhost/api/contracts', {
        method: 'POST',
        headers: akimatHeaders(),
        body: JSON.stringify(VALID_CONTRACT_BODY),
      })
    )

    expect(res.status).toBe(201)
    // contractor.create should NOT have been called
    expect(prismaMock.contractor.create).not.toHaveBeenCalled()
    // contract.create should use existing contractor id
    const createCall = prismaMock.contract.create.mock.calls[0][0]
    expect(createCall.data.contractorId).toBe('existing-co')
  })

  it('uses contractorId directly when provided (skips name lookup)', async () => {
    const bodyWithId = {
      ...VALID_CONTRACT_BODY,
      contractorName: undefined,
      contractorId: 'direct-co-id',
    }
    prismaMock.contract.create.mockResolvedValue({
      id: 'c-1',
      contractorId: 'direct-co-id',
      totalAmount: BigInt(100_000_000),
      escrowAmount: BigInt(20_000_000),
      contractor: { id: 'direct-co-id', name: 'Direct' },
      milestones: [],
    })

    const res = await ContractPOST(
      new NextRequest('http://localhost/api/contracts', {
        method: 'POST',
        headers: akimatHeaders(),
        body: JSON.stringify(bodyWithId),
      })
    )

    expect(res.status).toBe(201)
    // Neither findFirst nor create should have been called on contractor
    expect(prismaMock.contractor.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.contractor.create).not.toHaveBeenCalled()
  })

  it('idempotent: same onChainPubkey returns existing contract with 200', async () => {
    // Simulate unique constraint violation on create
    prismaMock.contractor.findFirst.mockResolvedValue({ id: 'co-1', name: 'ТОО СтройМастер' })
    prismaMock.contract.create.mockRejectedValue(
      new Error('Unique constraint failed on the fields: (`onChainPubkey`)')
    )

    const existingRecord = {
      id: 'c-existing',
      title: VALID_CONTRACT_BODY.title,
      district: VALID_CONTRACT_BODY.district,
      totalAmount: BigInt(100_000_000),
      escrowAmount: BigInt(20_000_000),
      onChainPubkey: 'Abc123OnChainPubkey',
      contractor: { id: 'co-1', name: 'ТОО СтройМастер' },
      milestones: [],
    }
    prismaMock.contract.findUnique.mockResolvedValue(existingRecord)

    const res = await ContractPOST(
      new NextRequest('http://localhost/api/contracts', {
        method: 'POST',
        headers: akimatHeaders(),
        body: JSON.stringify(VALID_CONTRACT_BODY),
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('c-existing')
    expect(json.onChainPubkey).toBe('Abc123OnChainPubkey')
  })

  it('PDA collision with different title/district returns 409', async () => {
    prismaMock.contractor.findFirst.mockResolvedValue({ id: 'co-1', name: 'ТОО СтройМастер' })
    prismaMock.contract.create.mockRejectedValue(
      new Error('Unique constraint failed on the fields: (`onChainPubkey`)')
    )

    // The existing record has a DIFFERENT title
    const conflictingRecord = {
      id: 'c-other',
      title: 'Другой контракт',
      district: 'Медеуский',
      totalAmount: BigInt(50_000_000),
      escrowAmount: BigInt(10_000_000),
      onChainPubkey: 'Abc123OnChainPubkey',
      contractor: { id: 'co-1', name: 'ТОО СтройМастер' },
      milestones: [],
    }
    prismaMock.contract.findUnique.mockResolvedValue(conflictingRecord)

    const res = await ContractPOST(
      new NextRequest('http://localhost/api/contracts', {
        method: 'POST',
        headers: akimatHeaders(),
        body: JSON.stringify(VALID_CONTRACT_BODY),
      })
    )

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('onChainPubkey')
  })

  it('returns 401 when no auth header is provided', async () => {
    const res = await ContractPOST(
      new NextRequest('http://localhost/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_CONTRACT_BODY),
      })
    )

    expect(res.status).toBe(401)
  })

  it('returns 403 when non-AKIMAT role tries to create a contract', async () => {
    const res = await ContractPOST(
      new NextRequest('http://localhost/api/contracts', {
        method: 'POST',
        headers: citizenHeaders(),
        body: JSON.stringify(VALID_CONTRACT_BODY),
      })
    )

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('Forbidden')
  })
})

// ===========================================================================
// A2. Penalty Triggering (POST /api/contracts/[id]/penalty)
// ===========================================================================

describe('A2. Penalty Triggering — POST /api/contracts/[id]/penalty', () => {
  const contractId = 'contract-pen-1'

  function baseContract(overrides: Partial<{
    totalAmount: bigint
    penaltyAmount: bigint
    penalties: Array<{ amountTenge: bigint }>
    district: string
  }> = {}) {
    return {
      id: contractId,
      title: 'Test contract',
      district: overrides.district ?? 'Ауэзовский',
      totalAmount: overrides.totalAmount ?? BigInt(100_000_000),
      penaltyAmount: overrides.penaltyAmount ?? BigInt(0),
      penalties: overrides.penalties ?? [],
      status: 'ACTIVE',
    }
  }

  function callPenalty(body: Record<string, unknown>) {
    return PenaltyPOST(
      new NextRequest(`http://localhost/api/contracts/${contractId}/penalty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: contractId }) }
    )
  }

  // -- TIME_OVERDUE --

  it('TIME_OVERDUE: amount = totalAmount x 0.01 x daysOverdue', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(baseContract())
    prismaMock.districtTreasury.findUnique.mockResolvedValue({
      id: 'treasury-1',
      district: 'Ауэзовский',
      balance: BigInt(500_000),
    })

    const penaltyResult = {
      id: 'penalty-1',
      contractId,
      type: 'TIME_OVERDUE',
      amountTenge: BigInt(5_000_000), // 100M * 0.01 * 5
      daysOverdue: 5,
      triggeredBy: null,
      txSignature: null,
      createdAt: new Date(),
    }
    const updatedContract = {
      id: contractId,
      penaltyAmount: BigInt(5_000_000),
      status: 'ACTIVE',
    }

    prismaMock.penalty.create.mockResolvedValue(penaltyResult)
    prismaMock.districtTreasury.update.mockResolvedValue({
      id: 'treasury-1',
      balance: BigInt(5_500_000),
    })
    prismaMock.contract.update.mockResolvedValue(updatedContract)
    // After transaction, treasury balance query
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: BigInt(500_000) })
      .mockResolvedValueOnce({ id: 'treasury-1', balance: BigInt(5_500_000) })

    const res = await callPenalty({
      type: 'TIME_OVERDUE',
      daysOverdue: 5,
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.penalty.amountTenge).toBe('5000000')
    expect(json.capped).toBe(false)

    // Verify penalty.create was called with correct amount
    const createCall = prismaMock.penalty.create.mock.calls[0][0]
    expect(createCall.data.amountTenge).toBe(BigInt(5_000_000))
    expect(createCall.data.type).toBe('TIME_OVERDUE')
    expect(createCall.data.daysOverdue).toBe(5)
  })

  // -- QUALITY_REJECTED --

  it('QUALITY_REJECTED: amount = totalAmount x 0.10 x rejectionCount', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(baseContract())
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: BigInt(0) })
      .mockResolvedValueOnce({ id: 'treasury-1', balance: BigInt(20_000_000) })

    const penaltyResult = {
      id: 'penalty-2',
      contractId,
      type: 'QUALITY_REJECTED',
      amountTenge: BigInt(20_000_000), // 100M * 0.10 * 2
      daysOverdue: null,
      triggeredBy: null,
      txSignature: null,
      createdAt: new Date(),
    }
    const updatedContract = {
      id: contractId,
      penaltyAmount: BigInt(20_000_000),
      status: 'ACTIVE',
    }

    prismaMock.penalty.create.mockResolvedValue(penaltyResult)
    prismaMock.districtTreasury.update.mockResolvedValue({
      id: 'treasury-1',
      balance: BigInt(20_000_000),
    })
    prismaMock.contract.update.mockResolvedValue(updatedContract)

    const res = await callPenalty({
      type: 'QUALITY_REJECTED',
      rejectionCount: 2,
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.penalty.amountTenge).toBe('20000000')
    expect(json.capped).toBe(false)

    const createCall = prismaMock.penalty.create.mock.calls[0][0]
    expect(createCall.data.amountTenge).toBe(BigInt(20_000_000))
    expect(createCall.data.type).toBe('QUALITY_REJECTED')
  })

  // -- GHOST_SITE --

  it('GHOST_SITE: amount = totalAmount x 0.05 x ghostCount', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(baseContract())
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: BigInt(0) })
      .mockResolvedValueOnce({ id: 'treasury-1', balance: BigInt(15_000_000) })

    const penaltyResult = {
      id: 'penalty-3',
      contractId,
      type: 'GHOST_SITE',
      amountTenge: BigInt(15_000_000), // 100M * 0.05 * 3
      daysOverdue: null,
      triggeredBy: null,
      txSignature: null,
      createdAt: new Date(),
    }
    const updatedContract = {
      id: contractId,
      penaltyAmount: BigInt(15_000_000),
      status: 'ACTIVE',
    }

    prismaMock.penalty.create.mockResolvedValue(penaltyResult)
    prismaMock.districtTreasury.update.mockResolvedValue({
      id: 'treasury-1',
      balance: BigInt(15_000_000),
    })
    prismaMock.contract.update.mockResolvedValue(updatedContract)

    const res = await callPenalty({
      type: 'GHOST_SITE',
      ghostCount: 3,
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.penalty.amountTenge).toBe('15000000')
    expect(json.capped).toBe(false)

    const createCall = prismaMock.penalty.create.mock.calls[0][0]
    expect(createCall.data.amountTenge).toBe(BigInt(15_000_000))
    expect(createCall.data.type).toBe('GHOST_SITE')
  })

  // -- 30% cap --

  it('caps penalty at 30% of totalAmount and sets status to PENALIZED', async () => {
    // Contract already has 25M in penalties. New 10M TIME_OVERDUE would exceed 30M cap.
    // actualPenalty = min(25M + 10M, 30M) - 25M = 5M
    prismaMock.contract.findUnique.mockResolvedValue(
      baseContract({
        penalties: [{ amountTenge: BigInt(25_000_000) }],
        penaltyAmount: BigInt(25_000_000),
      })
    )
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: BigInt(25_000_000) })
      .mockResolvedValueOnce({ id: 'treasury-1', balance: BigInt(30_000_000) })

    const penaltyResult = {
      id: 'penalty-cap',
      contractId,
      type: 'TIME_OVERDUE',
      amountTenge: BigInt(5_000_000), // capped: only 5M added to reach 30M
      daysOverdue: 10,
      triggeredBy: null,
      txSignature: null,
      createdAt: new Date(),
    }
    const updatedContract = {
      id: contractId,
      penaltyAmount: BigInt(30_000_000),
      status: 'PENALIZED',
    }

    prismaMock.penalty.create.mockResolvedValue(penaltyResult)
    prismaMock.districtTreasury.update.mockResolvedValue({
      id: 'treasury-1',
      balance: BigInt(30_000_000),
    })
    prismaMock.contract.update.mockResolvedValue(updatedContract)

    const res = await callPenalty({
      type: 'TIME_OVERDUE',
      daysOverdue: 10, // would be 10M uncapped
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    // The actual penalty stored is 5M (capped from 10M)
    expect(json.penalty.amountTenge).toBe('5000000')
    expect(json.capped).toBe(true)

    // Verify that the contract.update included status: 'PENALIZED'
    const updateCall = prismaMock.contract.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('PENALIZED')
  })

  it('returns 409 when cap already reached (no penalty due)', async () => {
    // Already at 30M cap (30% of 100M)
    prismaMock.contract.findUnique.mockResolvedValue(
      baseContract({
        penalties: [{ amountTenge: BigInt(30_000_000) }],
        penaltyAmount: BigInt(30_000_000),
      })
    )

    const res = await callPenalty({
      type: 'TIME_OVERDUE',
      daysOverdue: 1,
    })

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('cap already reached')
    expect(json.maxPenalty).toBe(30_000_000)
    expect(json.existingPenaltyTotal).toBe(30_000_000)
  })

  // -- Penalty amount flows to district treasury --

  it('penalty amount is added to district treasury balance via $transaction', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(baseContract())
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: BigInt(1_000_000) })
      .mockResolvedValueOnce({ id: 'treasury-1', balance: BigInt(2_000_000) })

    prismaMock.penalty.create.mockResolvedValue({
      id: 'p-1',
      amountTenge: BigInt(1_000_000),
      type: 'TIME_OVERDUE',
      createdAt: new Date(),
    })
    prismaMock.districtTreasury.update.mockResolvedValue({
      id: 'treasury-1',
      balance: BigInt(2_000_000),
    })
    prismaMock.contract.update.mockResolvedValue({
      id: contractId,
      penaltyAmount: BigInt(1_000_000),
      status: 'ACTIVE',
    })

    const res = await callPenalty({ type: 'TIME_OVERDUE', daysOverdue: 1 })

    expect(res.status).toBe(201)

    // Verify $transaction was called (the route uses array-style transaction)
    expect(prismaMock.$transaction).toHaveBeenCalled()

    // Verify district treasury update was called with increment
    const treasuryUpdateCall = prismaMock.districtTreasury.update.mock.calls[0][0]
    expect(treasuryUpdateCall.where.id).toBe('treasury-1')
    expect(treasuryUpdateCall.data.balance.increment).toBe(BigInt(1_000_000))
  })

  // -- Error cases --

  it('returns 400 for invalid penalty type', async () => {
    const res = await callPenalty({ type: 'INVALID_TYPE' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Invalid penalty type')
  })

  it('returns 400 when type is missing', async () => {
    const res = await callPenalty({})
    expect(res.status).toBe(400)
  })

  it('returns 404 when contract not found', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(null)

    const res = await callPenalty({ type: 'TIME_OVERDUE', daysOverdue: 1 })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('Contract not found')
  })

  it('returns 404 when district treasury not found', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(baseContract())
    // districtTreasury.findUnique defaults to null from resetPrismaMock

    const res = await callPenalty({ type: 'TIME_OVERDUE', daysOverdue: 1 })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('treasury not found')
  })

  it('returns 400 when TIME_OVERDUE has daysOverdue <= 0', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(baseContract())

    const res = await callPenalty({ type: 'TIME_OVERDUE', daysOverdue: 0 })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('daysOverdue')
  })

  it('returns 400 when QUALITY_REJECTED has no rejectionCount', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(baseContract())

    const res = await callPenalty({ type: 'QUALITY_REJECTED' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('rejectionCount')
  })

  it('returns 400 when GHOST_SITE has no ghostCount', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(baseContract())

    const res = await callPenalty({ type: 'GHOST_SITE' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('ghostCount')
  })

  it('passes triggeredBy and txSignature through to penalty record', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(baseContract())
    prismaMock.districtTreasury.findUnique
      .mockResolvedValueOnce({ id: 'treasury-1', district: 'Ауэзовский', balance: BigInt(0) })
      .mockResolvedValueOnce({ id: 'treasury-1', balance: BigInt(1_000_000) })

    prismaMock.penalty.create.mockResolvedValue({
      id: 'p-1',
      amountTenge: BigInt(1_000_000),
      type: 'TIME_OVERDUE',
      triggeredBy: 'akimat-user-1',
      txSignature: 'sig-abc123',
      createdAt: new Date(),
    })
    prismaMock.districtTreasury.update.mockResolvedValue({ id: 'treasury-1', balance: BigInt(1_000_000) })
    prismaMock.contract.update.mockResolvedValue({
      id: contractId,
      penaltyAmount: BigInt(1_000_000),
      status: 'ACTIVE',
    })

    const res = await callPenalty({
      type: 'TIME_OVERDUE',
      daysOverdue: 1,
      triggeredBy: 'akimat-user-1',
      txSignature: 'sig-abc123',
    })

    expect(res.status).toBe(201)
    const createCall = prismaMock.penalty.create.mock.calls[0][0]
    expect(createCall.data.triggeredBy).toBe('akimat-user-1')
    expect(createCall.data.txSignature).toBe('sig-abc123')
  })
})

// ===========================================================================
// A3. Treasury Proposal (POST /api/treasury/[district])
// ===========================================================================

describe('A3. Treasury Proposal — POST /api/treasury/[district]', () => {
  const district = 'Ауэзовский'

  function callTreasuryPost(body: Record<string, unknown>) {
    return TreasuryPOST(
      new NextRequest(`http://localhost/api/treasury/${encodeURIComponent(district)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ district }) }
    )
  }

  it('creates spending proposal with 14-day voting window', async () => {
    const treasury = {
      id: 'treasury-aue',
      district,
      balance: BigInt(50_000_000),
    }
    prismaMock.districtTreasury.findUnique.mockResolvedValue(treasury)

    const proposalBody = {
      title: 'Строительство детской площадки',
      description: 'Новая площадка в микрорайоне 3',
      amount: 5_000_000,
      category: 'INFRASTRUCTURE',
    }

    const now = Date.now()
    const expectedVotingEnd = new Date(now + 14 * 24 * 60 * 60 * 1000)

    const createdProposal = {
      id: 'proposal-1',
      treasuryId: 'treasury-aue',
      title: proposalBody.title,
      description: proposalBody.description,
      amount: BigInt(5_000_000),
      category: 'INFRASTRUCTURE',
      status: 'VOTING',
      votingEnds: expectedVotingEnd,
      votesFor: 0,
      votesAgainst: 0,
      createdAt: new Date(),
    }
    prismaMock.spendingProposal.create.mockResolvedValue(createdProposal)

    const res = await callTreasuryPost(proposalBody)

    expect(res.status).toBe(201)

    // Verify the proposal was created with correct data
    const createCall = prismaMock.spendingProposal.create.mock.calls[0][0]
    expect(createCall.data.treasuryId).toBe('treasury-aue')
    expect(createCall.data.title).toBe('Строительство детской площадки')
    expect(createCall.data.amount).toBe(BigInt(5_000_000))
    expect(createCall.data.status).toBe('VOTING')

    // Verify voting window is approximately 14 days from now
    const votingEnds = new Date(createCall.data.votingEnds).getTime()
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000
    const diff = Math.abs(votingEnds - (now + fourteenDaysMs))
    // Allow 5 seconds tolerance for test execution time
    expect(diff).toBeLessThan(5000)
  })

  it('returns 404 when treasury not found for the district', async () => {
    // districtTreasury.findUnique defaults to null from resetPrismaMock
    const res = await callTreasuryPost({
      title: 'Test',
      description: 'Test',
      amount: 1_000_000,
      category: 'INFRASTRUCTURE',
    })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('not found')
  })

  it('decodes URL-encoded Cyrillic district name correctly', async () => {
    const treasury = {
      id: 'treasury-med',
      district: 'Медеуский',
      balance: BigInt(10_000_000),
    }
    prismaMock.districtTreasury.findUnique.mockResolvedValue(treasury)
    prismaMock.spendingProposal.create.mockResolvedValue({
      id: 'proposal-2',
      treasuryId: 'treasury-med',
      status: 'VOTING',
    })

    const res = await TreasuryPOST(
      new NextRequest(
        `http://localhost/api/treasury/${encodeURIComponent('Медеуский')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Ремонт тротуаров',
            description: 'Вдоль проспекта Достык',
            amount: 3_000_000,
            category: 'ROAD',
          }),
        }
      ),
      { params: Promise.resolve({ district: 'Медеуский' }) }
    )

    expect(res.status).toBe(201)
    const findCall = prismaMock.districtTreasury.findUnique.mock.calls[0][0]
    expect(findCall.where.district).toBe('Медеуский')
  })

  it('links proposal to the correct treasury by treasuryId', async () => {
    const treasury = {
      id: 'treasury-specific',
      district,
      balance: BigInt(20_000_000),
    }
    prismaMock.districtTreasury.findUnique.mockResolvedValue(treasury)
    prismaMock.spendingProposal.create.mockResolvedValue({
      id: 'proposal-linked',
      treasuryId: 'treasury-specific',
      status: 'VOTING',
    })

    const res = await callTreasuryPost({
      title: 'Test linkage',
      description: 'Verify treasury linkage',
      amount: 1_000_000,
      category: 'EDUCATION',
    })

    expect(res.status).toBe(201)
    const createCall = prismaMock.spendingProposal.create.mock.calls[0][0]
    expect(createCall.data.treasuryId).toBe('treasury-specific')
  })
})
