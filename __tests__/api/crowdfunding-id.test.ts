import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET, POST, PATCH } = await import('@/app/api/crowdfunding/[id]/route')

beforeEach(() => resetPrismaMock())

const makeParams = (id: string) => Promise.resolve({ id })

describe('GET /api/crowdfunding/[id]', () => {
  it('returns campaign detail', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue({
      id: 'cf1', title: 'Test Campaign', status: 'ACTIVE',
      targetAmount: BigInt(10000000), citizenRaised: BigInt(500000),
    })

    const req = new NextRequest('http://localhost/api/crowdfunding/cf1')
    const res = await GET(req, { params: makeParams('cf1') })
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown campaign', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/crowdfunding/unknown')
    const res = await GET(req, { params: makeParams('unknown') })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/crowdfunding/[id] (contribute)', () => {
  const activeCampaign = {
    id: 'cf1', status: 'ACTIVE',
    targetAmount: BigInt(10000000),
    citizenTarget: BigInt(1000000),
    citizenRaised: BigInt(500000),
    deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    donorCount: 5,
  }

  it('accepts valid contribution', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(activeCampaign)
    prismaMock.campaignContribution.create.mockResolvedValue({ id: 'cont1', amount: BigInt(5000) })
    prismaMock.crowdfundingCampaign.update.mockResolvedValue({ ...activeCampaign, citizenRaised: BigInt(505000) })

    const req = new NextRequest('http://localhost/api/crowdfunding/cf1', {
      method: 'POST',
      body: JSON.stringify({ citizenId: 'c1', amount: 5000, anonymous: false }),
    })
    const res = await POST(req, { params: makeParams('cf1') })
    expect(res.status).toBe(201)
  })

  it('rejects contribution below 500₸', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(activeCampaign)

    const req = new NextRequest('http://localhost/api/crowdfunding/cf1', {
      method: 'POST',
      body: JSON.stringify({ citizenId: 'c1', amount: 100, anonymous: false }),
    })
    const res = await POST(req, { params: makeParams('cf1') })
    expect(res.status).toBe(400)
  })

  it('rejects contribution above 500000₸', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(activeCampaign)

    const req = new NextRequest('http://localhost/api/crowdfunding/cf1', {
      method: 'POST',
      body: JSON.stringify({ citizenId: 'c1', amount: 600000, anonymous: false }),
    })
    const res = await POST(req, { params: makeParams('cf1') })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/crowdfunding/[id] (status transitions)', () => {
  it('matches funded campaign', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue({
      id: 'cf1', status: 'FUNDED',
    })
    prismaMock.crowdfundingCampaign.update.mockResolvedValue({
      id: 'cf1', status: 'MATCHED',
    })

    const req = new NextRequest('http://localhost/api/crowdfunding/cf1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'match' }),
    })
    const res = await PATCH(req, { params: makeParams('cf1') })
    expect(res.status).toBe(200)
  })
})
