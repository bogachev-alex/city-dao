import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { POST } = await import('@/app/api/contracts/[id]/milestones/[milestoneId]/submit/route')

const AUTH_ID = 'contractor-auth-1'
const bearer = `Bearer ${Buffer.from(JSON.stringify({ role: 'CONTRACTOR', id: AUTH_ID }), 'utf8').toString('base64')}`

function submitRequest() {
  return new NextRequest(
    'http://localhost/api/contracts/c1/milestones/m1/submit',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: bearer,
        'x-user-role': 'CONTRACTOR',
      },
      body: JSON.stringify({ photoHashes: [], evidenceNote: '' }),
    }
  )
}

beforeEach(() => {
  resetPrismaMock()
})

describe('POST .../milestones/[milestoneId]/submit', () => {
  it('removes stale active JurySession (legacy GET bootstrap) then creates a new session', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'c1',
      contractorId: AUTH_ID,
      district: 'Медеуский',
      contractor: { name: 'Co', walletAddress: null },
      milestones: [
        { id: 'm1', status: 'PENDING', description: 'Step one', sortOrder: 1 },
      ],
    })

    prismaMock.jurySession.findMany.mockResolvedValue([{ id: 'orphan-sess' }])

    prismaMock.citizen.findMany.mockResolvedValue([
      { id: 'j1' },
      { id: 'j2' },
      { id: 'j3' },
    ])

    prismaMock.milestone.update.mockResolvedValue({ id: 'm1', status: 'UNDER_REVIEW' })
    prismaMock.jurySession.create.mockResolvedValue({
      id: 'new-sess',
      votes: [],
    })
    prismaMock.workLog.create.mockResolvedValue({ id: 'wl1' })

    const res = await POST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(201)
    expect(prismaMock.juryVote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: { in: ['orphan-sess'] } },
    })
    expect(prismaMock.jurySession.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['orphan-sess'] } },
    })
    expect(prismaMock.jurySession.create).toHaveBeenCalled()
  })

  it('removes all stale active JurySessions when multiple orphans exist', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'c1',
      contractorId: AUTH_ID,
      district: 'Медеуский',
      contractor: { name: 'Co', walletAddress: null },
      milestones: [{ id: 'm1', status: 'PENDING', description: 'A', sortOrder: 1 }],
    })
    prismaMock.jurySession.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    prismaMock.citizen.findMany.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }])
    prismaMock.milestone.update.mockResolvedValue({ id: 'm1', status: 'UNDER_REVIEW' })
    prismaMock.jurySession.create.mockResolvedValue({ id: 'new', votes: [] })
    prismaMock.workLog.create.mockResolvedValue({ id: 'w1' })

    const res = await POST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(201)
    expect(prismaMock.juryVote.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: { in: ['s1', 's2'] } },
    })
    expect(prismaMock.jurySession.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['s1', 's2'] } },
    })
  })

  it('creates session when no stale session exists', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'c1',
      contractorId: AUTH_ID,
      district: 'Медеуский',
      contractor: { name: 'Co', walletAddress: null },
      milestones: [{ id: 'm1', status: 'PENDING', description: 'A', sortOrder: 1 }],
    })
    prismaMock.jurySession.findMany.mockResolvedValue([])
    prismaMock.citizen.findMany.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }])
    prismaMock.milestone.update.mockResolvedValue({ id: 'm1', status: 'UNDER_REVIEW' })
    prismaMock.jurySession.create.mockResolvedValue({ id: 's1', votes: [] })
    prismaMock.workLog.create.mockResolvedValue({ id: 'w1' })

    const res = await POST(submitRequest(), {
      params: Promise.resolve({ id: 'c1', milestoneId: 'm1' }),
    })

    expect(res.status).toBe(201)
    expect(prismaMock.juryVote.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.jurySession.deleteMany).not.toHaveBeenCalled()
  })
})
