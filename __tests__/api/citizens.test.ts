import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/generated/prisma', () => ({ CitizenTier: { NEW: 'NEW', ACTIVE: 'ACTIVE', TRUSTED: 'TRUSTED', GUARDIAN: 'GUARDIAN' } }))

const { GET, POST, PATCH } = await import('@/app/api/citizens/route')

beforeEach(() => resetPrismaMock())

describe('GET /api/citizens', () => {
  it('returns citizen by wallet', async () => {
    const citizen = { id: 'c1', walletAddress: 'Wallet123', district: 'Медеуский', tier: 'NEW', reputationScore: 100 }
    prismaMock.citizen.findUnique.mockResolvedValue(citizen)

    const req = new NextRequest('http://localhost/api/citizens?wallet=Wallet123')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.walletAddress).toBe('Wallet123')
  })

  it('returns 404 for unknown wallet', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/citizens?wallet=Unknown')
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  it('returns list when no wallet param', async () => {
    prismaMock.citizen.findMany.mockResolvedValue([
      { id: 'c1', walletAddress: 'W1', reputationScore: 200 },
      { id: 'c2', walletAddress: 'W2', reputationScore: 100 },
    ])

    const req = new NextRequest('http://localhost/api/citizens')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(2)
  })
})

describe('POST /api/citizens', () => {
  it('creates a new citizen', async () => {
    prismaMock.citizen.findFirst.mockResolvedValue(null) // no duplicate
    prismaMock.citizen.create.mockResolvedValue({
      id: 'new-1', walletAddress: 'W1', district: 'Медеуский', iinHash: 'abc123',
      reputationScore: 100, tier: 'NEW', isEligible: true,
    })

    const req = new NextRequest('http://localhost/api/citizens', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: 'W1', district: 'Медеуский', iinHash: 'abc123' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 409 for duplicate wallet', async () => {
    prismaMock.citizen.findFirst.mockResolvedValue({ id: 'existing', walletAddress: 'W1' })

    const req = new NextRequest('http://localhost/api/citizens', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: 'W1', district: 'Медеуский', iinHash: 'abc123' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/citizens', () => {
  it('updates reputation and tier', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue({ id: 'c1', reputationScore: 140 })
    prismaMock.citizen.update.mockResolvedValue({ id: 'c1', reputationScore: 155, tier: 'TRUSTED' })

    const req = new NextRequest('http://localhost/api/citizens', {
      method: 'PATCH',
      body: JSON.stringify({ walletAddress: 'W1', reputationDelta: 15 }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.tier).toBe('TRUSTED')
  })
})
