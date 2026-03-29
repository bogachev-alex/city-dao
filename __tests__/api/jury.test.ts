import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET, POST, PATCH } = await import('@/app/api/jury/route')

beforeEach(() => resetPrismaMock())

describe('GET /api/jury', () => {
  it('returns session by ID', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue({
      id: 's1', status: 'COMMIT_PHASE', votes: [],
    })
    const res = await GET(new NextRequest('http://localhost/api/jury?sessionId=s1'))
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown session', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/jury?sessionId=x'))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/jury (commit)', () => {
  it('commits vote for valid juror', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: null })
    prismaMock.juryVote.update.mockResolvedValue({ id: 'v1', commitHash: 'hash123' })

    const res = await POST(new NextRequest('http://localhost/api/jury', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'c1', commitHash: 'hash123' }),
    }))
    expect(res.status).toBe(200)
  })

  it('403 for non-juror', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue(null)
    const res = await POST(new NextRequest('http://localhost/api/jury', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'intruder', commitHash: 'x' }),
    }))
    expect(res.status).toBe(403)
  })

  it('409 if already committed', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: 'existing' })
    const res = await POST(new NextRequest('http://localhost/api/jury', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'c1', commitHash: 'new' }),
    }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/jury (reveal) — hash verification', () => {
  // BUG FIX: Backend now verifies hash(vote:salt) === commitHash
  it('accepts reveal when hash matches', async () => {
    const vote = 'accept'
    const salt = 'testsalt123'
    const correctHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')

    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1', commitHash: correctHash, revealedVote: null, weight: 1,
    })
    prismaMock.juryVote.update.mockResolvedValue({ id: 'v1', revealedVote: vote, revealedSalt: salt })
    prismaMock.juryVote.findMany.mockResolvedValue([{ revealedVote: vote, weight: 1 }])
    prismaMock.jurySession.update.mockResolvedValue({ id: 's1' })

    const res = await PATCH(new NextRequest('http://localhost/api/jury', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'c1', vote, salt }),
    }))
    expect(res.status).toBe(200)
  })

  it('REJECTS reveal when hash does NOT match (vote manipulation)', async () => {
    // Juror committed hash for "reject" but tries to reveal "accept"
    const commitHash = createHash('sha256').update('reject:originalsalt').digest('hex')

    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1', commitHash, revealedVote: null,
    })

    const res = await PATCH(new NextRequest('http://localhost/api/jury', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'c1', vote: 'accept', salt: 'differentsalt' }),
    }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Hash mismatch')
  })

  it('400 if not yet committed', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: null })
    const res = await PATCH(new NextRequest('http://localhost/api/jury', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId: 's1', citizenId: 'c1', vote: 'accept', salt: 'x' }),
    }))
    expect(res.status).toBe(400)
  })
})
