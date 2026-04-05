import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { POST } = await import('@/app/api/contractors/register/route')

beforeEach(() => resetPrismaMock())

describe('POST /api/contractors/register', () => {
  it('returns 400 when name is missing', async () => {
    const res = await POST(new NextRequest('http://localhost/api/contractors/register', {
      method: 'POST',
      body: JSON.stringify({ walletAddress: 'W1' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 when walletAddress is missing', async () => {
    const res = await POST(new NextRequest('http://localhost/api/contractors/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'СтройКаз' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate wallet', async () => {
    prismaMock.contractor.findFirst.mockResolvedValue({ id: 'co1', walletAddress: 'W1', name: 'Old' })

    const res = await POST(new NextRequest('http://localhost/api/contractors/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'New', walletAddress: 'W1' }),
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('creates contractor and returns 201', async () => {
    prismaMock.contractor.findFirst.mockResolvedValue(null)
    prismaMock.contractor.create.mockResolvedValue({
      id: 'co-new',
      name: 'СтройКаз',
      walletAddress: 'W1',
      rating: 'A',
      reputationScore: 50,
    })

    const res = await POST(new NextRequest('http://localhost/api/contractors/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'СтройКаз', walletAddress: 'W1', biin: '123456789012' }),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('СтройКаз')
    expect(body.walletAddress).toBe('W1')
  })

  it('passes correct default fields to create', async () => {
    prismaMock.contractor.findFirst.mockResolvedValue(null)
    prismaMock.contractor.create.mockResolvedValue({ id: 'co-new', name: 'Тест' })

    await POST(new NextRequest('http://localhost/api/contractors/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Тест', walletAddress: 'W2' }),
    }))

    const createCall = prismaMock.contractor.create.mock.calls[0][0]
    expect(createCall.data.rating).toBe('A')
    expect(createCall.data.reputationScore).toBe(50)
    expect(createCall.data.walletAddress).toBe('W2')
  })
})
