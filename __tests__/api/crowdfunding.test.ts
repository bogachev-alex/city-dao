import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const listRoute = await import('@/app/api/crowdfunding/route')
const detailRoute = await import('@/app/api/crowdfunding/[id]/route')

beforeEach(() => resetPrismaMock())

const makeParams = (id: string) => Promise.resolve({ id })

describe('POST /api/crowdfunding — create campaign', () => {
  it('calculates correct citizen/state split for PLAYGROUND (90% state)', async () => {
    prismaMock.crowdfundingCampaign.create.mockResolvedValue({ id: 'cf1' })

    const res = await listRoute.POST(new NextRequest('http://localhost/api/crowdfunding', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test', description: 'Desc', district: 'A',
        category: 'PLAYGROUND', targetAmount: 10000000,
        deadline: '2026-06-01', creatorId: 'c1',
        onChainPubkey: '11111111111111111111111111111111',
      }),
    }))
    expect(res.status).toBe(201)

    const data = prismaMock.crowdfundingCampaign.create.mock.calls[0][0].data
    expect(Number(data.citizenTarget)).toBe(1000000)  // 10%
    expect(Number(data.stateMatch)).toBe(9000000)     // 90%
  })

  it('400 when required fields missing', async () => {
    const res = await listRoute.POST(new NextRequest('http://localhost/api/crowdfunding', {
      method: 'POST',
      body: JSON.stringify({ title: 'Only title' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/crowdfunding/[id] — contribute', () => {
  const activeCampaign = {
    id: 'cf1', status: 'ACTIVE',
    targetAmount: BigInt(10000000),
    citizenTarget: BigInt(1000000),
    citizenRaised: BigInt(500000),
    deadline: new Date(Date.now() + 10 * 86400000),
    donorCount: 5,
  }

  it('rejects < 500₸', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(activeCampaign)
    const res = await detailRoute.POST(
      new NextRequest('http://localhost/api/crowdfunding/cf1', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 100, anonymous: false }),
      }),
      { params: makeParams('cf1') }
    )
    expect(res.status).toBe(400)
  })

  it('rejects > 500,000₸', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(activeCampaign)
    const res = await detailRoute.POST(
      new NextRequest('http://localhost/api/crowdfunding/cf1', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 600000, anonymous: false }),
      }),
      { params: makeParams('cf1') }
    )
    expect(res.status).toBe(400)
  })

  it('accepts valid contribution', async () => {
    prismaMock.crowdfundingCampaign.findUnique
      .mockResolvedValueOnce(activeCampaign)
      .mockResolvedValueOnce({
        ...activeCampaign,
        citizenRaised: BigInt(505000),
        donorCount: 6,
      })
    prismaMock.citizen.findUnique.mockResolvedValue({ id: 'c1' })
    prismaMock.campaignContribution.create.mockResolvedValue({ id: 'cont1' })
    prismaMock.crowdfundingCampaign.update.mockResolvedValue({
      ...activeCampaign,
      citizenRaised: BigInt(505000),
      donorCount: 6,
    })

    const res = await detailRoute.POST(
      new NextRequest('http://localhost/api/crowdfunding/cf1', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 5000, anonymous: false }),
      }),
      { params: makeParams('cf1') }
    )
    expect(res.status).toBe(201)
  })

  it('rejects contribution to expired campaign', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue({
      ...activeCampaign,
      deadline: new Date(Date.now() - 86400000), // yesterday
    })
    const res = await detailRoute.POST(
      new NextRequest('http://localhost/api/crowdfunding/cf1', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 5000, anonymous: false }),
      }),
      { params: makeParams('cf1') }
    )
    expect(res.status).toBe(400)
  })

  it('creates linked contract when contribution reaches citizen target (FUNDED)', async () => {
    const campaign = {
      id: 'cf1',
      status: 'ACTIVE' as const,
      title: 'Crowd project',
      description: 'Description',
      district: 'Ауэзовский',
      lat: 43.2,
      lng: 76.9,
      targetAmount: BigInt(5_000_000),
      citizenTarget: BigInt(5_000_000),
      citizenRaised: BigInt(4_995_000),
      stateMatch: BigInt(0),
      deadline: new Date(Date.now() + 30 * 86400000),
      donorCount: 10,
      contractId: null,
      category: 'COMMERCIAL' as const,
    }
    let updateCall = 0
    prismaMock.crowdfundingCampaign.findUnique
      .mockResolvedValueOnce(campaign)
      .mockResolvedValueOnce({
        ...campaign,
        citizenRaised: BigInt(5_000_000),
        donorCount: 11,
        status: 'MATCHED',
        stateDeposited: true,
        contractId: 'ct-new',
      })
    prismaMock.citizen.findUnique.mockResolvedValue({ id: 'c1' })
    prismaMock.campaignContribution.create.mockResolvedValue({ id: 'cont1' })
    prismaMock.crowdfundingCampaign.update.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      updateCall += 1
      if (updateCall === 1) {
        return {
          ...campaign,
          citizenRaised: BigInt(5_000_000),
          donorCount: 11,
          status: 'FUNDED',
          contractId: null,
        }
      }
      return { ...campaign, ...args.data } as typeof campaign
    })
    prismaMock.contractor.findFirst.mockResolvedValue({
      id: 'ph-id',
      name: 'Подрядчик не назначен',
    })
    prismaMock.contract.create.mockResolvedValue({ id: 'ct-new' })

    const res = await detailRoute.POST(
      new NextRequest('http://localhost/api/crowdfunding/cf1', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 5000, anonymous: false }),
      }),
      { params: makeParams('cf1') }
    )
    expect(res.status).toBe(201)
    expect(prismaMock.contract.create).toHaveBeenCalled()
  })
})
