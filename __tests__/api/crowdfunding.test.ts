import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET, POST } = await import('@/app/api/crowdfunding/route')

beforeEach(() => resetPrismaMock())

describe('GET /api/crowdfunding', () => {
  it('returns campaigns list', async () => {
    prismaMock.crowdfundingCampaign.findMany.mockResolvedValue([
      { id: 'cf1', title: 'Campaign 1', status: 'ACTIVE' },
      { id: 'cf2', title: 'Campaign 2', status: 'FUNDED' },
    ])

    const req = new NextRequest('http://localhost/api/crowdfunding')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(2)
  })

  it('filters by district', async () => {
    prismaMock.crowdfundingCampaign.findMany.mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/crowdfunding?district=Медеуский')
    const res = await GET(req)

    expect(prismaMock.crowdfundingCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ district: 'Медеуский' }),
      })
    )
  })
})

describe('POST /api/crowdfunding', () => {
  it('creates campaign with correct citizen/state split', async () => {
    prismaMock.crowdfundingCampaign.create.mockResolvedValue({
      id: 'cf-new', title: 'Test', status: 'ACTIVE',
      targetAmount: BigInt(10000000), citizenTarget: BigInt(1000000), stateMatch: BigInt(9000000),
    })

    const req = new NextRequest('http://localhost/api/crowdfunding', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test', description: 'Desc', district: 'Ауэзовский',
        category: 'PLAYGROUND', targetAmount: 10000000,
        deadline: '2026-06-01', creatorId: 'c1',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)

    // Verify the split was calculated correctly (90% state for PLAYGROUND)
    const createCall = prismaMock.crowdfundingCampaign.create.mock.calls[0][0]
    expect(Number(createCall.data.citizenTarget)).toBe(1000000) // 10% of 10M
    expect(Number(createCall.data.stateMatch)).toBe(9000000)    // 90% of 10M
  })

  it('returns 400 when required fields missing', async () => {
    const req = new NextRequest('http://localhost/api/crowdfunding', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }), // missing most fields
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
