import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET: getCrowdfundingQueue } = await import(
  '@/app/api/akimat/crowdfunding-queue/route'
)

beforeEach(() => resetPrismaMock())

describe('GET /api/akimat/crowdfunding-queue', () => {
  it('401 without auth', async () => {
    const res = await getCrowdfundingQueue(new NextRequest('http://localhost/api/akimat/crowdfunding-queue'))
    expect(res.status).toBe(401)
  })

  it('403 for CITIZEN', async () => {
    const res = await getCrowdfundingQueue(
      new NextRequest('http://localhost/api/akimat/crowdfunding-queue', {
        headers: { 'x-user-role': 'CITIZEN' },
      })
    )
    expect(res.status).toBe(403)
  })

  it('200 for AKIMAT with queue and contractors', async () => {
    prismaMock.contract.findMany.mockResolvedValue([
      {
        id: 'ct1',
        contractor: { id: 'ph', name: 'Подрядчик не назначен' },
        crowdfunding: {
          id: 'cf1',
          title: 'Парк',
          district: 'Медеуский',
          status: 'MATCHED',
          citizenRaised: BigInt(1_000_000),
          citizenTarget: BigInt(1_000_000),
          stateDeposited: true,
        },
      },
    ] as any)
    prismaMock.contractor.findMany.mockResolvedValue([
      { id: 'c1', name: 'ТОО Строй' },
    ] as any)

    const res = await getCrowdfundingQueue(
      new NextRequest('http://localhost/api/akimat/crowdfunding-queue', {
        headers: { 'x-user-role': 'AKIMAT' },
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.queue).toHaveLength(1)
    expect(body.queue[0].id).toBe('ct1')
    expect(body.contractors).toHaveLength(1)
    expect(body.contractors[0].name).toBe('ТОО Строй')
  })
})
