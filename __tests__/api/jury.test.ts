import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET, POST, PATCH } = await import('@/app/api/jury/route')

beforeEach(() => resetPrismaMock())

describe('GET /api/jury', () => {
  it('returns session by sessionId', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue({
      id: 's1', status: 'COMMIT_PHASE', votes: [],
      contract: { title: 'Test', district: 'Медеуский' },
      milestone: { description: 'Phase 1' },
    })

    const req = new NextRequest('http://localhost/api/jury?sessionId=s1')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown session', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/jury?sessionId=unknown')
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  it('returns active sessions list when no sessionId', async () => {
    prismaMock.jurySession.findMany.mockResolvedValue([
      { id: 's1', status: 'COMMIT_PHASE' },
    ])

    const req = new NextRequest('http://localhost/api/jury')
    const res = await GET(req)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })
})

describe('POST /api/jury (commit vote)', () => {
  it('commits vote for valid juror', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1', sessionId: 's1', citizenId: 'c1', commitHash: null,
    })
    prismaMock.juryVote.update.mockResolvedValue({
      id: 'v1', commitHash: 'abc123',
    })

    const req = new NextRequest('http://localhost/api/jury', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'c1', commitHash: 'abc123' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('returns 403 for non-juror', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/jury', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'not-a-juror', commitHash: 'abc' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 409 if already committed', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1', commitHash: 'already-committed',
    })

    const req = new NextRequest('http://localhost/api/jury', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'c1', commitHash: 'new-hash' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/jury (reveal vote)', () => {
  it('reveals vote and records result', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1', sessionId: 's1', citizenId: 'c1', commitHash: 'hash123', revealedVote: null, weight: 1,
    })
    prismaMock.juryVote.update.mockResolvedValue({
      id: 'v1', revealedVote: 'accept', revealedSalt: 'salt123',
    })
    // All votes check
    prismaMock.juryVote.findMany.mockResolvedValue([
      { id: 'v1', revealedVote: 'accept', weight: 1 },
    ])
    prismaMock.jurySession.update.mockResolvedValue({
      id: 's1', weightedAccept: 1, weightedReject: 0,
    })

    const req = new NextRequest('http://localhost/api/jury', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'c1', vote: 'accept', salt: 'salt123' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 if not yet committed', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1', commitHash: null, revealedVote: null,
    })

    const req = new NextRequest('http://localhost/api/jury', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'c1', vote: 'accept', salt: 'salt' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
