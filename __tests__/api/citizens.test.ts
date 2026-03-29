import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/generated/prisma', () => ({
  CitizenTier: { NEW: 'NEW', ACTIVE: 'ACTIVE', TRUSTED: 'TRUSTED', GUARDIAN: 'GUARDIAN' },
}))

const { GET, POST, PATCH } = await import('@/app/api/citizens/route')

beforeEach(() => resetPrismaMock())

describe('GET /api/citizens', () => {
  it('returns citizen by wallet', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue({ id: 'c1', walletAddress: 'W1' })
    const res = await GET(new NextRequest('http://localhost/api/citizens?wallet=W1'))
    expect(res.status).toBe(200)
  })

  it('404 for unknown wallet', async () => {
    const res = await GET(new NextRequest('http://localhost/api/citizens?wallet=Unknown'))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/citizens', () => {
  it('creates citizen', async () => {
    prismaMock.citizen.findFirst.mockResolvedValue(null)
    prismaMock.citizen.create.mockResolvedValue({ id: 'new', tier: 'NEW' })
    const res = await POST(new NextRequest('http://localhost/api/citizens', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: 'W1', district: 'Медеуский', iinHash: 'abc' }),
    }))
    expect(res.status).toBe(201)
  })

  it('409 for duplicate', async () => {
    prismaMock.citizen.findFirst.mockResolvedValue({ id: 'existing' })
    const res = await POST(new NextRequest('http://localhost/api/citizens', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: 'W1', district: 'A', iinHash: 'x' }),
    }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/citizens — computeTier', () => {
  // BUG FIX: profile page thresholds now match API: 0-50 NEW, 50-150 ACTIVE, 150-300 TRUSTED, 300+ GUARDIAN
  it.each([
    [0, 15, 'NEW'],      // 0+15=15 < 50 → NEW
    [40, 15, 'ACTIVE'],  // 40+15=55 >= 50 → ACTIVE
    [140, 15, 'TRUSTED'],// 140+15=155 >= 150 → TRUSTED
    [290, 15, 'GUARDIAN'],// 290+15=305 >= 300 → GUARDIAN
  ])('score %d + delta %d → tier %s', async (current, delta, expectedTier) => {
    prismaMock.citizen.findUnique.mockResolvedValue({ id: 'c1', reputationScore: current })
    prismaMock.citizen.update.mockResolvedValue({ id: 'c1', reputationScore: current + delta, tier: expectedTier })

    const res = await PATCH(new NextRequest('http://localhost/api/citizens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'AKIMAT' },
      body: JSON.stringify({ walletAddress: 'W1', reputationDelta: delta }),
    }))
    expect(res.status).toBe(200)

    // Verify the correct tier was passed to update
    const updateCall = prismaMock.citizen.update.mock.calls[0][0]
    expect(updateCall.data.tier).toBe(expectedTier)
  })
})
