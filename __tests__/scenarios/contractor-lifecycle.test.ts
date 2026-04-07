import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

// Mock ownsContract for milestone submission tests
const ownsContractMock = vi.fn().mockReturnValue(true)
vi.mock('@/lib/ownsContract', () => ({
  ownsContract: ownsContractMock,
}))

// ---------- Route imports ----------
const { POST: RegisterPOST } = await import('@/app/api/contractors/register/route')
const { POST: SubmitPOST } = await import(
  '@/app/api/contracts/[id]/milestones/[milestoneId]/submit/route'
)
const { GET: RolesGET } = await import('@/app/api/roles/route')

// ---------- Helpers ----------
function contractorHeaders(): HeadersInit {
  const token = Buffer.from(
    JSON.stringify({ role: 'CONTRACTOR', id: 'demo-contractor-1' })
  ).toString('base64')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

function submitRequest(
  body: { photoHashes?: string[]; evidenceNote?: string } = {}
) {
  return new NextRequest(
    'http://localhost/api/contracts/c1/milestones/m1/submit',
    {
      method: 'POST',
      headers: contractorHeaders(),
      body: JSON.stringify(body),
    }
  )
}

function defaultContract(overrides?: Record<string, unknown>) {
  return {
    id: 'c1',
    district: 'Ауэзовский',
    contractorId: 'contractor-1',
    contractor: { name: 'ТОО СтройАлматы', walletAddress: 'wallet123' },
    milestones: [
      {
        id: 'm1',
        description: 'Фундамент',
        status: 'PENDING',
        deadlineDays: 30,
        tranchePct: 30,
        sortOrder: 1,
      },
    ],
    ...overrides,
  }
}

function seedJurors(count = 3) {
  const citizens = Array.from({ length: count }, (_, i) => ({
    id: `citizen-${i + 1}`,
  }))
  prismaMock.citizen.findMany.mockResolvedValue(citizens)
}

function seedSubmitTransaction() {
  prismaMock.milestone.update.mockResolvedValue({
    id: 'm1',
    status: 'UNDER_REVIEW',
  })
  prismaMock.jurySession.create.mockResolvedValue({
    id: 'js1',
    contractId: 'c1',
    milestoneId: 'm1',
    status: 'COMMIT_PHASE',
    votes: [
      { citizenId: 'citizen-1' },
      { citizenId: 'citizen-2' },
      { citizenId: 'citizen-3' },
    ],
  })
  prismaMock.workLog.create.mockResolvedValue({ id: 'wl1' })
}

// ---------- Tests ----------

beforeEach(() => {
  resetPrismaMock()
  ownsContractMock.mockReset()
  ownsContractMock.mockReturnValue(true)
})

// ==========================================
// B1. Contractor Registration
// ==========================================
describe('B1. Contractor Registration (POST /api/contractors/register)', () => {
  it('registers with name + walletAddress and returns rating=A, reputationScore=50', async () => {
    prismaMock.contractor.findFirst.mockResolvedValue(null)
    prismaMock.contractor.create.mockResolvedValue({
      id: 'co-new',
      name: 'ТОО КазСтрой',
      walletAddress: 'W1',
      rating: 'A',
      reputationScore: 50,
    })

    const res = await RegisterPOST(
      new NextRequest('http://localhost/api/contractors/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'ТОО КазСтрой', walletAddress: 'W1' }),
      })
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('ТОО КазСтрой')
    expect(body.walletAddress).toBe('W1')
    expect(body.rating).toBe('A')
    expect(body.reputationScore).toBe(50)

    // Verify create was called with correct default fields
    const createArg = prismaMock.contractor.create.mock.calls[0][0]
    expect(createArg.data.rating).toBe('A')
    expect(createArg.data.reputationScore).toBe(50)
    expect(createArg.data.onTimeRate).toBe(0.5)
    expect(createArg.data.acceptanceRate).toBe(0.5)
    expect(createArg.data.updateFrequency).toBe(0.5)
    expect(createArg.data.gpsAccuracy).toBe(0.5)
    expect(createArg.data.blockerSpeed).toBe(0.5)
  })

  it('rejects missing name with 400', async () => {
    const res = await RegisterPOST(
      new NextRequest('http://localhost/api/contractors/register', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: 'W1' }),
      })
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('rejects empty name (whitespace only) with 400', async () => {
    const res = await RegisterPOST(
      new NextRequest('http://localhost/api/contractors/register', {
        method: 'POST',
        body: JSON.stringify({ name: '   ', walletAddress: 'W1' }),
      })
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('rejects missing walletAddress with 400', async () => {
    const res = await RegisterPOST(
      new NextRequest('http://localhost/api/contractors/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'СтройКаз' }),
      })
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('rejects empty walletAddress (whitespace only) with 400', async () => {
    const res = await RegisterPOST(
      new NextRequest('http://localhost/api/contractors/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'СтройКаз', walletAddress: '  ' }),
      })
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('rejects duplicate walletAddress with 409', async () => {
    prismaMock.contractor.findFirst.mockResolvedValue({
      id: 'existing-co',
      walletAddress: 'W1',
      name: 'Existing Corp',
    })

    const res = await RegisterPOST(
      new NextRequest('http://localhost/api/contractors/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Corp', walletAddress: 'W1' }),
      })
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBeDefined()
    expect(body.contractor).toBeDefined()
    expect(body.contractor.id).toBe('existing-co')
  })

  it('does not call create when duplicate detected', async () => {
    prismaMock.contractor.findFirst.mockResolvedValue({
      id: 'existing-co',
      walletAddress: 'W1',
      name: 'Existing',
    })

    await RegisterPOST(
      new NextRequest('http://localhost/api/contractors/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'New', walletAddress: 'W1' }),
      })
    )

    expect(prismaMock.contractor.create).not.toHaveBeenCalled()
  })
})

// ==========================================
// B2. Milestone Submission
// ==========================================
describe('B2. Milestone Submission (POST /api/contracts/[id]/milestones/[milestoneId]/submit)', () => {
  it('successful submission: creates jury session + work log, milestone -> UNDER_REVIEW, returns 201', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(defaultContract())
    prismaMock.jurySession.findMany.mockResolvedValue([])
    seedJurors(3)
    seedSubmitTransaction()

    const res = await SubmitPOST(
      submitRequest({
        photoHashes: ['QmTest123'],
        evidenceNote: 'Photos attached',
      }),
      { params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }) }
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.milestone.status).toBe('UNDER_REVIEW')
    expect(body.session.status).toBe('COMMIT_PHASE')
    expect(body.session.votes).toHaveLength(3)

    // Verify milestone was updated to UNDER_REVIEW
    expect(prismaMock.milestone.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: { status: 'UNDER_REVIEW' },
      })
    )

    // Verify jury session was created
    expect(prismaMock.jurySession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractId: 'c1',
          milestoneId: 'm1',
          status: 'COMMIT_PHASE',
        }),
      })
    )

    // Verify work log was created
    expect(prismaMock.workLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractId: 'c1',
          milestoneId: 'm1',
          type: 'MILESTONE_CLAIM',
        }),
      })
    )
  })

  it('cleans up stale jury sessions before creating a new one', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(defaultContract())
    prismaMock.jurySession.findMany.mockResolvedValue([
      { id: 'stale-1' },
      { id: 'stale-2' },
    ])
    seedJurors(3)
    seedSubmitTransaction()

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(201)

    // Verify stale votes and sessions were cleaned up
    expect(prismaMock.juryVote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: { in: ['stale-1', 'stale-2'] } },
    })
    expect(prismaMock.jurySession.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['stale-1', 'stale-2'] } },
    })

    // Verify new session was still created
    expect(prismaMock.jurySession.create).toHaveBeenCalled()
  })

  it('skips stale session cleanup when none exist', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(defaultContract())
    prismaMock.jurySession.findMany.mockResolvedValue([])
    seedJurors(3)
    seedSubmitTransaction()

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(201)
    expect(prismaMock.juryVote.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.jurySession.deleteMany).not.toHaveBeenCalled()
  })

  it('returns 403 if not contract owner', async () => {
    ownsContractMock.mockReturnValue(false)

    prismaMock.contract.findUnique.mockResolvedValue({
      ...defaultContract(),
      contractorId: 'other-contractor',
    })

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/Forbidden/)
  })

  it('returns 404 if contract not found', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(null)

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'nonexistent', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/Contract not found/)
  })

  it('returns 404 if milestone not in contract', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(defaultContract())

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'nonexistent-m' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/Milestone not found/)
  })

  it('returns 400 if milestone is ACCEPTED (non-submittable status)', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(
      defaultContract({
        milestones: [
          {
            id: 'm1',
            description: 'Фундамент',
            status: 'ACCEPTED',
            deadlineDays: 30,
            tranchePct: 30,
            sortOrder: 1,
          },
        ],
      })
    )

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Cannot submit milestone/)
  })

  it('returns 400 if milestone is REJECTED (non-submittable status)', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(
      defaultContract({
        milestones: [
          {
            id: 'm1',
            description: 'Фундамент',
            status: 'REJECTED',
            deadlineDays: 30,
            tranchePct: 30,
            sortOrder: 1,
          },
        ],
      })
    )

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Cannot submit milestone/)
  })

  it('allows resubmission when milestone status is SUBMITTED', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(
      defaultContract({
        milestones: [
          {
            id: 'm1',
            description: 'Фундамент',
            status: 'SUBMITTED',
            deadlineDays: 30,
            tranchePct: 30,
            sortOrder: 1,
          },
        ],
      })
    )
    prismaMock.jurySession.findMany.mockResolvedValue([])
    seedJurors(3)
    seedSubmitTransaction()

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(201)
  })

  it('returns 503 if not enough citizens for jury (fewer than 3)', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(defaultContract())
    prismaMock.jurySession.findMany.mockResolvedValue([])

    // pickJurors calls citizen.findMany twice: first for local district, then fallback.
    // Return 2 local + 0 fallback = only 2 total (need 3)
    prismaMock.citizen.findMany
      .mockResolvedValueOnce([{ id: 'citizen-1' }, { id: 'citizen-2' }])
      .mockResolvedValueOnce([])

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/Not enough citizens/)
  })

  it('creates work log with photo hashes and evidence note', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(defaultContract())
    prismaMock.jurySession.findMany.mockResolvedValue([])
    seedJurors(3)
    seedSubmitTransaction()

    const photoHashes = ['QmPhoto1', 'QmPhoto2']
    const evidenceNote = 'Фото фундамента и акт приёма'

    const res = await SubmitPOST(
      submitRequest({ photoHashes, evidenceNote }),
      { params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }) }
    )

    expect(res.status).toBe(201)

    const workLogCall = prismaMock.workLog.create.mock.calls[0][0]
    expect(workLogCall.data.photoHashes).toEqual(['QmPhoto1', 'QmPhoto2'])
    expect(workLogCall.data.description).toBe('Фото фундамента и акт приёма')
    expect(workLogCall.data.contractorId).toBe('contractor-1')
    expect(workLogCall.data.type).toBe('MILESTONE_CLAIM')
    expect(workLogCall.data.completionPct).toBe(100)
  })

  it('uses default description when evidenceNote is empty', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(defaultContract())
    prismaMock.jurySession.findMany.mockResolvedValue([])
    seedJurors(3)
    seedSubmitTransaction()

    await SubmitPOST(submitRequest({ evidenceNote: '' }), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    const workLogCall = prismaMock.workLog.create.mock.calls[0][0]
    expect(workLogCall.data.description).toBe(
      'Материалы переданы на проверку жюри.'
    )
  })

  it('returns 401 when no auth token is provided', async () => {
    const req = new NextRequest(
      'http://localhost/api/contracts/c1/milestones/m1/submit',
      { method: 'POST', body: JSON.stringify({}) }
    )

    const res = await SubmitPOST(req, {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(401)
  })

  it('returns 403 when called with CITIZEN role', async () => {
    const citizenToken = Buffer.from(
      JSON.stringify({ role: 'CITIZEN', id: 'citizen-1' })
    ).toString('base64')

    const req = new NextRequest(
      'http://localhost/api/contracts/c1/milestones/m1/submit',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({}),
      }
    )

    const res = await SubmitPOST(req, {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/Forbidden/)
  })

  it('returns 400 when contract has no contractor assigned', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(
      defaultContract({ contractorId: null, contractor: null })
    )

    const res = await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no contractor/)
  })

  it('uses $transaction for atomic milestone update, session creation, and work log', async () => {
    prismaMock.contract.findUnique.mockResolvedValue(defaultContract())
    prismaMock.jurySession.findMany.mockResolvedValue([])
    seedJurors(3)
    seedSubmitTransaction()

    await SubmitPOST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    // The route uses prisma.$transaction(async (tx) => { ... })
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function))
  })
})

// ==========================================
// B3. Contractor Roles
// ==========================================
describe('B3. Contractor Roles (GET /api/roles)', () => {
  it('returns CONTRACTOR role for registered contractor', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue(null)
    prismaMock.contractor.findFirst.mockResolvedValue({
      id: 'co1',
      walletAddress: 'W1',
      name: 'ТОО СтройАлматы',
    })

    const res = await RolesGET(
      new NextRequest('http://localhost/api/roles?wallet=W1')
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roles).toContain('CONTRACTOR')
  })

  it('returns contractor name in names field', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue(null)
    prismaMock.contractor.findFirst.mockResolvedValue({
      id: 'co1',
      walletAddress: 'W1',
      name: 'ТОО КазСтрой',
    })

    const res = await RolesGET(
      new NextRequest('http://localhost/api/roles?wallet=W1')
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.names['CONTRACTOR']).toBe('ТОО КазСтрой')
  })

  it('returns empty roles when contractor wallet is not registered', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue(null)
    prismaMock.contractor.findFirst.mockResolvedValue(null)

    const res = await RolesGET(
      new NextRequest('http://localhost/api/roles?wallet=Unknown')
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roles).toEqual([])
    expect(body.names).toEqual({})
  })

  it('returns 400 when wallet parameter is missing', async () => {
    const res = await RolesGET(
      new NextRequest('http://localhost/api/roles')
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns both CITIZEN and CONTRACTOR when wallet has both registrations', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue({
      id: 'c1',
      walletAddress: 'W1',
    })
    prismaMock.contractor.findFirst.mockResolvedValue({
      id: 'co1',
      walletAddress: 'W1',
      name: 'ТОО МногоРолей',
    })

    const res = await RolesGET(
      new NextRequest('http://localhost/api/roles?wallet=W1')
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roles).toContain('CITIZEN')
    expect(body.roles).toContain('CONTRACTOR')
    expect(body.names['CONTRACTOR']).toBe('ТОО МногоРолей')
  })
})
