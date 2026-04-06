import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET } = await import('@/app/api/contracts/[id]/route')

function baseContract(overrides: {
  milestones: Array<{ id: string; sortOrder: number; status: string; description?: string }>
}) {
  return {
    id: 'contract-c1',
    title: 'Test contract',
    district: 'Медеуский',
    contractor: { id: 'co1', name: 'Подрядчик' },
    milestones: overrides.milestones.map((m) => ({
      description: m.description ?? 'Step',
      ...m,
    })),
    jurySessions: [],
    penalties: [],
    workLogs: [],
  }
}

beforeEach(() => {
  resetPrismaMock()
  delete process.env.DISABLE_JURY_SESSION_BOOTSTRAP
})

afterEach(() => {
  delete process.env.DISABLE_JURY_SESSION_BOOTSTRAP
})

describe('GET /api/contracts/[id] ensureJurySessionForTesting', () => {
  it('does not create JurySession when the first actionable milestone is SUBMITTED (regression: avoid 409 on submit)', async () => {
    const payload = baseContract({
      milestones: [
        { id: 'm-a', sortOrder: 1, status: 'ACCEPTED' },
        { id: 'm-b', sortOrder: 2, status: 'SUBMITTED' },
        { id: 'm-c', sortOrder: 3, status: 'PENDING' },
      ],
    })

    let findCount = 0
    prismaMock.contract.findUnique.mockImplementation(async () => {
      findCount++
      return { ...payload }
    })

    const res = await GET(new NextRequest('http://localhost/api/contracts/contract-c1'), {
      params: Promise.resolve({ id: 'contract-c1' }),
    })

    expect(res.status).toBe(200)
    expect(prismaMock.jurySession.create).not.toHaveBeenCalled()
    expect(findCount).toBeGreaterThanOrEqual(2)
  })

  it('does not create JurySession when only PENDING milestones exist', async () => {
    const payload = baseContract({
      milestones: [
        { id: 'm1', sortOrder: 1, status: 'ACCEPTED' },
        { id: 'm2', sortOrder: 2, status: 'PENDING' },
      ],
    })

    prismaMock.contract.findUnique.mockResolvedValue({ ...payload })

    const res = await GET(new NextRequest('http://localhost/api/contracts/contract-c1'), {
      params: Promise.resolve({ id: 'contract-c1' }),
    })

    expect(res.status).toBe(200)
    expect(prismaMock.jurySession.create).not.toHaveBeenCalled()
  })

  it('creates JurySession when a milestone is UNDER_REVIEW and no active session exists', async () => {
    const payload = baseContract({
      milestones: [
        { id: 'm1', sortOrder: 1, status: 'ACCEPTED' },
        { id: 'm2', sortOrder: 2, status: 'UNDER_REVIEW' },
      ],
    })

    prismaMock.contract.findUnique.mockResolvedValue({ ...payload })
    prismaMock.jurySession.create.mockResolvedValue({ id: 'sess1' })

    const res = await GET(new NextRequest('http://localhost/api/contracts/contract-c1'), {
      params: Promise.resolve({ id: 'contract-c1' }),
    })

    expect(res.status).toBe(200)
    expect(prismaMock.jurySession.create).toHaveBeenCalledTimes(1)
    const createArg = prismaMock.jurySession.create.mock.calls[0][0]
    expect(createArg.data.milestoneId).toBe('m2')
  })

  it('skips bootstrap when DISABLE_JURY_SESSION_BOOTSTRAP=1', async () => {
    process.env.DISABLE_JURY_SESSION_BOOTSTRAP = '1'

    const payload = baseContract({
      milestones: [
        { id: 'm1', sortOrder: 1, status: 'ACCEPTED' },
        { id: 'm2', sortOrder: 2, status: 'UNDER_REVIEW' },
      ],
    })

    prismaMock.contract.findUnique.mockResolvedValue({ ...payload })

    const res = await GET(new NextRequest('http://localhost/api/contracts/contract-c1'), {
      params: Promise.resolve({ id: 'contract-c1' }),
    })

    expect(res.status).toBe(200)
    expect(prismaMock.jurySession.create).not.toHaveBeenCalled()
    expect(prismaMock.citizen.findMany).not.toHaveBeenCalled()
  })
})
