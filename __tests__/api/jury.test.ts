import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { GET, POST, PATCH } = await import('@/app/api/jury/route')

/** Base58 Solana address (matches isSolanaAddress in blockchainDashboardModel). */
const JUROR_WALLET = '3zuYfqNAXFy8RYYSo6guiXXRPNc1hTvw7CFiLUnXoQWp'

function juryAuthHeaders(): HeadersInit {
  const token = Buffer.from(JSON.stringify({ role: 'CITIZEN', id: JUROR_WALLET }), 'utf8').toString('base64')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

const sessionRow = {
  id: 's1',
  contractId: 'contract1',
  milestoneId: 'm1',
  status: 'COMMIT_PHASE' as const,
  commitDeadline: new Date(),
  revealDeadline: new Date(),
  weightedAccept: 0,
  weightedReject: 0,
  result: null as null,
  contract: { id: 'contract1', title: 'T', district: 'D', onChainPubkey: null as string | null },
  milestone: { id: 'm1', description: 'Milestone A' },
  votes: [] as unknown[],
}

const openSessionRow = {
  id: 's1',
  status: 'COMMIT_PHASE' as const,
  commitDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
  revealDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
  contractId: 'contract1',
  milestoneId: 'm1',
  contract: sessionRow.contract,
  milestone: sessionRow.milestone,
  votes: [] as unknown[],
}

beforeEach(() => {
  resetPrismaMock()
  prismaMock.milestone.findMany.mockResolvedValue([{ id: 'm1' }])
  prismaMock.workLog.findFirst.mockResolvedValue({ photoHashes: ['QmTest123'] })
  prismaMock.citizen.findUnique.mockImplementation((args: { where: { walletAddress?: string; id?: string } }) => {
    if (args?.where?.walletAddress) return Promise.resolve({ id: 'c1' })
    if (args?.where?.id) return Promise.resolve({ id: 'c1', isEligible: true, banUntil: null })
    return Promise.resolve(null)
  })
})

describe('GET /api/jury', () => {
  it('returns session by ID with enrichment fields', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue({ ...sessionRow })

    const res = await GET(new NextRequest('http://localhost/api/jury?sessionId=s1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.milestoneIndexOnChain).toBe(0)
    expect(Array.isArray(data.evidencePhotoUrls)).toBe(true)
    expect(data.evidencePhotoUrls.length).toBeGreaterThan(0)
  })

  it('returns 404 for unknown session', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/jury?sessionId=x'))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/jury (commit)', () => {
  it('commits vote for valid juror', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue(openSessionRow)
    prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: null })
    prismaMock.juryVote.update.mockResolvedValue({ id: 'v1', commitHash: 'hash123' })

    const res = await POST(
      new NextRequest('http://localhost/api/jury', {
        method: 'POST',
        headers: juryAuthHeaders(),
        body: JSON.stringify({ sessionId: 's1', commitHash: 'hash123' }),
      }),
    )
    expect(res.status).toBe(200)
  })

  it('creates jury vote row when citizen was not pre-selected (open jury)', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue(openSessionRow)
    prismaMock.juryVote.findFirst.mockResolvedValue(null)
    prismaMock.juryVote.create.mockResolvedValue({ id: 'vnew', sessionId: 's1', citizenId: 'c1', commitHash: null })
    prismaMock.juryVote.update.mockResolvedValue({ id: 'vnew', commitHash: 'hash123' })

    const res = await POST(
      new NextRequest('http://localhost/api/jury', {
        method: 'POST',
        headers: juryAuthHeaders(),
        body: JSON.stringify({ sessionId: 's1', commitHash: 'hash123' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(prismaMock.juryVote.create).toHaveBeenCalled()
  })

  it('401 without auth', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue(openSessionRow)
    prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: null })
    const res = await POST(
      new NextRequest('http://localhost/api/jury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 's1', commitHash: 'hash123' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('403 when citizen id is not a Solana wallet', async () => {
    const token = Buffer.from(JSON.stringify({ role: 'CITIZEN', id: 'demo-citizen-1' }), 'utf8').toString('base64')
    prismaMock.jurySession.findUnique.mockResolvedValue(openSessionRow)
    prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: null })
    const res = await POST(
      new NextRequest('http://localhost/api/jury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: 's1', commitHash: 'hash123' }),
      }),
    )
    expect(res.status).toBe(403)
  })

  it('409 if already committed', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValue(openSessionRow)
    prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: 'existing' })
    const res = await POST(
      new NextRequest('http://localhost/api/jury', {
        method: 'POST',
        headers: juryAuthHeaders(),
        body: JSON.stringify({ sessionId: 's1', commitHash: 'new' }),
      }),
    )
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/jury (reveal) — hash verification', () => {
  it('accepts reveal when hash matches and finalizes early on single ACCEPT', async () => {
    const vote = 'accept'
    const salt = 'testsalt123'
    const correctHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')

    prismaMock.jurySession.findUnique
      .mockResolvedValueOnce(openSessionRow)
      .mockResolvedValueOnce({ status: 'COMMIT_PHASE', milestoneId: 'm1' })
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1',
      commitHash: correctHash,
      revealedVote: null,
      weight: 1,
    })
    prismaMock.juryVote.update.mockResolvedValue({ id: 'v1', revealedVote: vote, revealedSalt: salt })
    prismaMock.juryVote.findMany.mockResolvedValue([
      { revealedVote: 'ACCEPT', weight: 1, commitHash: correctHash },
    ])
    prismaMock.juryVote.findUnique.mockResolvedValue({ id: 'v1' })
    prismaMock.jurySession.update.mockResolvedValue({ id: 's1' })
    prismaMock.milestone.update.mockResolvedValue({ id: 'm1', tranchePct: 30 })
    prismaMock.contract.findUnique.mockResolvedValue({
      id: 'contract1',
      totalAmount: BigInt(100_000_000),
      escrowAmount: BigInt(20_000_000),
      paidAmount: BigInt(0),
      milestones: [{ id: 'm1', status: 'ACCEPTED' }],
    })
    prismaMock.contract.update.mockResolvedValue({
      id: 'contract1',
      escrowAmount: BigInt(0),
      paidAmount: BigInt(30_000_000),
      status: 'COMPLETED',
    })

    const res = await PATCH(
      new NextRequest('http://localhost/api/jury', {
        method: 'PATCH',
        headers: juryAuthHeaders(),
        body: JSON.stringify({ sessionId: 's1', vote, salt }),
      }),
    )
    expect(res.status).toBe(200)
    expect(prismaMock.jurySession.update).toHaveBeenCalled()
    expect(prismaMock.milestone.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: { status: 'ACCEPTED' },
      }),
    )
    // Verify payment was processed and contract completed (single milestone)
    expect(prismaMock.contract.update).toHaveBeenCalled()
    const data = await res.json()
    expect(data.payment).toBeDefined()
    expect(data.payment.amount).toBe('30000000')
    expect(data.payment.contractCompleted).toBe(true)
  })

  it('REJECTS reveal when hash does NOT match (vote manipulation)', async () => {
    const commitHash = createHash('sha256').update('reject:originalsalt').digest('hex')

    prismaMock.jurySession.findUnique.mockResolvedValueOnce(openSessionRow)
    prismaMock.juryVote.findFirst.mockResolvedValue({
      id: 'v1',
      commitHash,
      revealedVote: null,
    })

    const res = await PATCH(
      new NextRequest('http://localhost/api/jury', {
        method: 'PATCH',
        headers: juryAuthHeaders(),
        body: JSON.stringify({ sessionId: 's1', vote: 'accept', salt: 'differentsalt' }),
      }),
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Hash mismatch')
  })

  it('400 if not yet committed', async () => {
    prismaMock.jurySession.findUnique.mockResolvedValueOnce(openSessionRow)
    prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: null })
    const res = await PATCH(
      new NextRequest('http://localhost/api/jury', {
        method: 'PATCH',
        headers: juryAuthHeaders(),
        body: JSON.stringify({ sessionId: 's1', vote: 'accept', salt: 'x' }),
      }),
    )
    expect(res.status).toBe(400)
  })
})
