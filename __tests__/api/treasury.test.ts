import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET, POST, PATCH } = await import('@/app/api/treasury/[district]/route')

beforeEach(() => resetPrismaMock())

const makeParams = (district: string) => Promise.resolve({ district })

describe('GET /api/treasury/[district]', () => {
  it('returns treasury with proposals', async () => {
    prismaMock.districtTreasury.findUnique.mockResolvedValue({
      id: 't1', district: 'Ауэзовский', proposals: [],
    })
    const res = await GET(
      new NextRequest('http://localhost/api/treasury/test'),
      { params: makeParams('Ауэзовский') }
    )
    expect(res.status).toBe(200)
  })

  it('404 for unknown district', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/treasury/test'),
      { params: makeParams('Несуществующий') }
    )
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/treasury/[district] — voting', () => {
  it('records a vote', async () => {
    prismaMock.proposalVote.findUnique.mockResolvedValue(null)
    prismaMock.proposalVote.create.mockResolvedValue({ id: 'v1' })
    prismaMock.spendingProposal.update.mockResolvedValue({ id: 'p1', votesFor: 1 })

    const res = await PATCH(
      new NextRequest('http://localhost/api/treasury/test', {
        method: 'PATCH',
        body: JSON.stringify({ proposalId: 'p1', citizenId: 'c1', inFavor: true, txSignature: 'demo-signature' }),
      }),
      { params: makeParams('Ауэзовский') }
    )
    expect(res.status).toBe(200)
  })

  it('409 for duplicate vote', async () => {
    prismaMock.proposalVote.findUnique.mockResolvedValue({ id: 'existing' })

    const res = await PATCH(
      new NextRequest('http://localhost/api/treasury/test', {
        method: 'PATCH',
        body: JSON.stringify({ proposalId: 'p1', citizenId: 'c1', inFavor: true, txSignature: 'demo-signature' }),
      }),
      { params: makeParams('Ауэзовский') }
    )
    expect(res.status).toBe(409)
  })

  it('400 without on-chain confirmation', async () => {
    const res = await PATCH(
      new NextRequest('http://localhost/api/treasury/test', {
        method: 'PATCH',
        body: JSON.stringify({ proposalId: 'p1', citizenId: 'c1', inFavor: true }),
      }),
      { params: makeParams('Ауэзовский') }
    )
    expect(res.status).toBe(400)
  })
})
