import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET: getContracts, POST: postContracts } = await import(
  '@/app/api/contracts/route'
)
const { PATCH: patchContract } = await import(
  '@/app/api/contracts/[id]/route'
)
const { getRoleFromRequest } = await import('@/lib/auth-server')

beforeEach(() => resetPrismaMock())

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeToken(role: string) {
  return `Bearer ${Buffer.from(JSON.stringify({ role, id: 'test-id' })).toString('base64')}`
}

function postReq(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/contracts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      title: 'Test contract',
      contractorName: 'ТОО Тест',
      totalAmount: 1000000,
      deadline: '2027-01-01',
      district: 'Медеуский',
      lat: 43.2,
      lng: 76.9,
      onChainPubkey: '11111111111111111111111111111111',
      milestones: [{ description: 'M1', deadlineDays: 30, tranchePct: 100 }],
    }),
  })
}

function patchReq(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/contracts/c1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ status: 'COMPLETED' }),
  })
}

// ─── GET /api/contracts — public, no auth required ───────────────────────────

describe('GET /api/contracts', () => {
  it('returns 200 without any auth', async () => {
    prismaMock.contract.findMany.mockResolvedValue([])
    const res = await getContracts(new NextRequest('http://localhost/api/contracts'))
    expect(res.status).toBe(200)
  })
})

// ─── POST /api/contracts — AKIMAT only ───────────────────────────────────────

describe('POST /api/contracts — role access control', () => {
  it('401 when no auth header is provided', async () => {
    const res = await postContracts(postReq())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('403 when role is CITIZEN', async () => {
    const res = await postContracts(postReq({ 'x-user-role': 'CITIZEN' }))
    expect(res.status).toBe(403)
  })

  it('403 when role is CONTRACTOR', async () => {
    const res = await postContracts(postReq({ 'x-user-role': 'CONTRACTOR' }))
    expect(res.status).toBe(403)
  })

  it('201 when role is AKIMAT via x-user-role header', async () => {
    prismaMock.contractor.findFirst.mockResolvedValue(null)
    prismaMock.contractor.create.mockResolvedValue({ id: 'ctr1', name: 'ТОО Тест' })
    prismaMock.contract.create.mockResolvedValue({
      id: 'c1',
      title: 'Test',
      contractor: { id: 'ctr1', name: 'ТОО Тест' },
      milestones: [],
    })
    const res = await postContracts(postReq({ 'x-user-role': 'AKIMAT' }))
    expect(res.status).toBe(201)
  })

  it('201 when AKIMAT role is passed via Bearer token', async () => {
    prismaMock.contractor.findFirst.mockResolvedValue(null)
    prismaMock.contractor.create.mockResolvedValue({ id: 'ctr1', name: 'ТОО Тест' })
    prismaMock.contract.create.mockResolvedValue({
      id: 'c1',
      title: 'Test',
      contractor: { id: 'ctr1', name: 'ТОО Тест' },
      milestones: [],
    })
    const res = await postContracts(postReq({ authorization: makeToken('AKIMAT') }))
    expect(res.status).toBe(201)
  })

  it('401 when Bearer token is malformed', async () => {
    const res = await postContracts(
      postReq({ authorization: 'Bearer not-valid-base64!!!' })
    )
    expect(res.status).toBe(401)
  })
})

// ─── PATCH /api/contracts/[id] — AKIMAT only ─────────────────────────────────

describe('PATCH /api/contracts/[id] — role access control', () => {
  const fakeParams = Promise.resolve({ id: 'c1' })

  it('401 with no auth', async () => {
    const res = await patchContract(patchReq(), { params: fakeParams })
    expect(res.status).toBe(401)
  })

  it('403 with CITIZEN role', async () => {
    const res = await patchContract(
      patchReq({ 'x-user-role': 'CITIZEN' }),
      { params: fakeParams }
    )
    expect(res.status).toBe(403)
  })

  it('403 with CONTRACTOR role', async () => {
    const res = await patchContract(
      patchReq({ 'x-user-role': 'CONTRACTOR' }),
      { params: fakeParams }
    )
    expect(res.status).toBe(403)
  })

  it('200 with AKIMAT role', async () => {
    prismaMock.contract.update.mockResolvedValue({ id: 'c1', status: 'COMPLETED' })
    const res = await patchContract(
      patchReq({ 'x-user-role': 'AKIMAT' }),
      { params: fakeParams }
    )
    expect(res.status).toBe(200)
  })
})

// ─── lib/auth-server unit tests ───────────────────────────────────────────────

describe('getRoleFromRequest', () => {
  it('returns null when no headers', () => {
    const req = new NextRequest('http://localhost/')
    expect(getRoleFromRequest(req)).toBeNull()
  })

  it('reads role from x-user-role header', () => {
    const req = new NextRequest('http://localhost/', {
      headers: { 'x-user-role': 'AKIMAT' },
    })
    expect(getRoleFromRequest(req)).toBe('AKIMAT')
  })

  it('rejects invalid role values', () => {
    const req = new NextRequest('http://localhost/', {
      headers: { 'x-user-role': 'SUPERADMIN' },
    })
    expect(getRoleFromRequest(req)).toBeNull()
  })

  it('reads role from Bearer token', () => {
    const token = Buffer.from(JSON.stringify({ role: 'CONTRACTOR' })).toString('base64')
    const req = new NextRequest('http://localhost/', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(getRoleFromRequest(req)).toBe('CONTRACTOR')
  })

  it('x-user-role header takes priority over Bearer', () => {
    const token = Buffer.from(JSON.stringify({ role: 'CITIZEN' })).toString('base64')
    const req = new NextRequest('http://localhost/', {
      headers: {
        'x-user-role': 'AKIMAT',
        authorization: `Bearer ${token}`,
      },
    })
    expect(getRoleFromRequest(req)).toBe('AKIMAT')
  })
})
