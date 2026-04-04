import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET } = await import('@/app/api/roles/route')

beforeEach(() => resetPrismaMock())

describe('GET /api/roles', () => {
  it('returns 400 when wallet is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/roles'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns empty roles for unknown wallet', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue(null)
    prismaMock.contractor.findFirst.mockResolvedValue(null)

    const res = await GET(new NextRequest('http://localhost/api/roles?wallet=UnknownWallet'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roles).toEqual([])
    expect(body.names).toEqual({})
  })

  it('returns CITIZEN role for registered citizen', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue({ id: 'c1', walletAddress: 'W1', name: 'Иван' })
    prismaMock.contractor.findFirst.mockResolvedValue(null)

    const res = await GET(new NextRequest('http://localhost/api/roles?wallet=W1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roles).toContain('CITIZEN')
    expect(body.roles).not.toContain('CONTRACTOR')
  })

  it('returns CONTRACTOR role with name for registered contractor', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue(null)
    prismaMock.contractor.findFirst.mockResolvedValue({ id: 'co1', walletAddress: 'W1', name: 'ООС Строй' })

    const res = await GET(new NextRequest('http://localhost/api/roles?wallet=W1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roles).toContain('CONTRACTOR')
    expect(body.names['CONTRACTOR']).toBe('ООС Строй')
  })

  it('returns both roles when wallet is citizen and contractor', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue({ id: 'c1', walletAddress: 'W1' })
    prismaMock.contractor.findFirst.mockResolvedValue({ id: 'co1', walletAddress: 'W1', name: 'СтройКаз' })

    const res = await GET(new NextRequest('http://localhost/api/roles?wallet=W1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roles).toEqual(['CITIZEN', 'CONTRACTOR'])
    expect(body.names['CONTRACTOR']).toBe('СтройКаз')
  })
})
