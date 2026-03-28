import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const routeModule = await import('@/app/api/treasury/[district]/route')
const { GET, POST, PATCH } = routeModule

beforeEach(() => resetPrismaMock())

const makeParams = (district: string) => Promise.resolve({ district })

describe('GET /api/treasury/[district]', () => {
  it('returns treasury with proposals', async () => {
    prismaMock.districtTreasury.findUnique.mockResolvedValue({
      id: 't1', district: 'Ауэзовский', balance: BigInt(6000000),
      proposals: [{ id: 'p1', title: 'Test', status: 'VOTING', votesFor: 0, votesAgainst: 0 }],
    })

    const req = new NextRequest('http://localhost/api/treasury/%D0%90%D1%83%D1%8D%D0%B7%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9')
    const res = await GET(req, { params: makeParams('Ауэзовский') })
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown district', async () => {
    prismaMock.districtTreasury.findUnique.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/treasury/Unknown')
    const res = await GET(req, { params: makeParams('Unknown') })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/treasury/[district]', () => {
  it('creates a spending proposal', async () => {
    prismaMock.districtTreasury.findUnique.mockResolvedValue({ id: 't1' })
    prismaMock.spendingProposal.create.mockResolvedValue({
      id: 'p1', title: 'New Proposal', status: 'VOTING', votesFor: 0, votesAgainst: 0,
    })

    const req = new NextRequest('http://localhost/api/treasury/test', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Proposal', description: 'Desc', amount: 5000000, category: 'Инфраструктура' }),
    })
    const res = await POST(req, { params: makeParams('Ауэзовский') })
    expect(res.status).toBe(201)
  })
})

describe('PATCH /api/treasury/[district]', () => {
  it('records a vote', async () => {
    prismaMock.proposalVote.findUnique.mockResolvedValue(null)
    prismaMock.proposalVote.create.mockResolvedValue({ id: 'v1', inFavor: true })
    prismaMock.spendingProposal.update.mockResolvedValue({ id: 'p1', votesFor: 1 })

    const req = new NextRequest('http://localhost/api/treasury/test', {
      method: 'PATCH',
      body: JSON.stringify({ proposalId: 'p1', citizenId: 'c1', inFavor: true }),
    })
    const res = await PATCH(req, { params: makeParams('Ауэзовский') })
    expect(res.status).toBe(200)
  })

  it('returns 409 for duplicate vote', async () => {
    prismaMock.proposalVote.findUnique.mockResolvedValue({ id: 'existing-vote' })

    const req = new NextRequest('http://localhost/api/treasury/test', {
      method: 'PATCH',
      body: JSON.stringify({ proposalId: 'p1', citizenId: 'c1', inFavor: true }),
    })
    const res = await PATCH(req, { params: makeParams('Ауэзовский') })
    expect(res.status).toBe(409)
  })
})
