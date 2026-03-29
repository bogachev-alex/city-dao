/**
 * Comprehensive access-control tests.
 * Covers requireRole() enforcement across all protected API routes:
 *   POST   /api/crowdfunding          → CITIZEN only
 *   POST   /api/crowdfunding/[id]     → CITIZEN only (contribute)
 *   PATCH  /api/crowdfunding/[id]     → AKIMAT only  (status update)
 *   POST   /api/treasury/[district]   → AKIMAT only  (create proposal)
 *   PATCH  /api/treasury/[district]   → CITIZEN only (vote)
 *   POST   /api/jury                  → CITIZEN only (commit vote)
 *   PATCH  /api/jury                  → CITIZEN only (reveal vote)
 *   POST   /api/work-logs             → CONTRACTOR or AKIMAT
 *   PATCH  /api/citizens              → AKIMAT only
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

// ── Route imports (top-level await required by Vitest/oxc) ─────────────────────

const { GET: getCrowdfunding, POST: postCrowdfunding } = await import(
  '@/app/api/crowdfunding/route'
)
const {
  GET: getCrowdfundingById,
  POST: postCrowdfundingById,
  PATCH: patchCrowdfundingById,
} = await import('@/app/api/crowdfunding/[id]/route')

const {
  GET: getTreasury,
  POST: postTreasury,
  PATCH: patchTreasury,
} = await import('@/app/api/treasury/[district]/route')

const {
  GET: getJury,
  POST: postJury,
  PATCH: patchJury,
} = await import('@/app/api/jury/route')

const { GET: getWorkLogs, POST: postWorkLogs } = await import(
  '@/app/api/work-logs/route'
)

const {
  GET: getCitizens,
  POST: postCitizens,
  PATCH: patchCitizens,
} = await import('@/app/api/citizens/route')

// ── Helpers ────────────────────────────────────────────────────────────────────

beforeEach(() => resetPrismaMock())

function withRole(role: string) {
  return { 'x-user-role': role }
}

function bearerToken(role: string) {
  const token = Buffer.from(JSON.stringify({ role, id: 'test-id' })).toString('base64')
  return { authorization: `Bearer ${token}` }
}

function req(
  url: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: object,
  headers: Record<string, string> = {}
) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const campaignBody = {
  title: 'Test Campaign',
  description: 'Test description',
  district: 'Медеуский',
  category: 'PLAYGROUND',
  targetAmount: 1000000,
  deadline: '2027-01-01',
  creatorId: 'citizen-1',
}

const contributeBody = {
  citizenId: 'citizen-1',
  amount: 1000,
}

const campaignParams = Promise.resolve({ id: 'camp-1' })
const districtParams = Promise.resolve({ district: 'Медеуский' })

// ─────────────────────────────────────────────────────────────────────────────
// /api/crowdfunding
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/crowdfunding — CITIZEN only', () => {
  it('401 with no auth', async () => {
    const res = await postCrowdfunding(req('http://localhost/api/crowdfunding', 'POST', campaignBody))
    expect(res.status).toBe(401)
  })

  it('403 for CONTRACTOR', async () => {
    const res = await postCrowdfunding(
      req('http://localhost/api/crowdfunding', 'POST', campaignBody, withRole('CONTRACTOR'))
    )
    expect(res.status).toBe(403)
  })

  it('403 for AKIMAT', async () => {
    const res = await postCrowdfunding(
      req('http://localhost/api/crowdfunding', 'POST', campaignBody, withRole('AKIMAT'))
    )
    expect(res.status).toBe(403)
  })

  it('201 for CITIZEN via x-user-role header', async () => {
    prismaMock.crowdfundingCampaign.create.mockResolvedValue({
      id: 'camp-1',
      title: campaignBody.title,
      creator: { id: 'citizen-1', walletAddress: 'addr', tier: 'NEW' },
    } as any)
    const res = await postCrowdfunding(
      req('http://localhost/api/crowdfunding', 'POST', campaignBody, withRole('CITIZEN'))
    )
    expect(res.status).toBe(201)
  })

  it('201 for CITIZEN via Bearer token', async () => {
    prismaMock.crowdfundingCampaign.create.mockResolvedValue({
      id: 'camp-1',
      title: campaignBody.title,
      creator: { id: 'citizen-1', walletAddress: 'addr', tier: 'NEW' },
    } as any)
    const res = await postCrowdfunding(
      req('http://localhost/api/crowdfunding', 'POST', campaignBody, bearerToken('CITIZEN'))
    )
    expect(res.status).toBe(201)
  })
})

describe('GET /api/crowdfunding — public', () => {
  it('200 with no auth', async () => {
    prismaMock.crowdfundingCampaign.findMany.mockResolvedValue([])
    const res = await getCrowdfunding(req('http://localhost/api/crowdfunding', 'GET'))
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// /api/crowdfunding/[id]
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/crowdfunding/[id] — CITIZEN only (contribute)', () => {
  it('401 with no auth', async () => {
    const res = await postCrowdfundingById(
      req('http://localhost/api/crowdfunding/camp-1', 'POST', contributeBody),
      { params: campaignParams }
    )
    expect(res.status).toBe(401)
  })

  it('403 for CONTRACTOR', async () => {
    const res = await postCrowdfundingById(
      req('http://localhost/api/crowdfunding/camp-1', 'POST', contributeBody, withRole('CONTRACTOR')),
      { params: campaignParams }
    )
    expect(res.status).toBe(403)
  })

  it('403 for AKIMAT', async () => {
    const res = await postCrowdfundingById(
      req('http://localhost/api/crowdfunding/camp-1', 'POST', contributeBody, withRole('AKIMAT')),
      { params: campaignParams }
    )
    expect(res.status).toBe(403)
  })

  it('passes auth check for CITIZEN (may 404 due to mock)', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(null)
    const res = await postCrowdfundingById(
      req('http://localhost/api/crowdfunding/camp-1', 'POST', contributeBody, withRole('CITIZEN')),
      { params: campaignParams }
    )
    // Role check passed — campaign not found in mock, so 404 is fine
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

describe('PATCH /api/crowdfunding/[id] — AKIMAT only (status update)', () => {
  it('401 with no auth', async () => {
    const res = await patchCrowdfundingById(
      req('http://localhost/api/crowdfunding/camp-1', 'PATCH', { action: 'expire' }),
      { params: campaignParams }
    )
    expect(res.status).toBe(401)
  })

  it('403 for CITIZEN', async () => {
    const res = await patchCrowdfundingById(
      req('http://localhost/api/crowdfunding/camp-1', 'PATCH', { action: 'expire' }, withRole('CITIZEN')),
      { params: campaignParams }
    )
    expect(res.status).toBe(403)
  })

  it('403 for CONTRACTOR', async () => {
    const res = await patchCrowdfundingById(
      req('http://localhost/api/crowdfunding/camp-1', 'PATCH', { action: 'expire' }, withRole('CONTRACTOR')),
      { params: campaignParams }
    )
    expect(res.status).toBe(403)
  })

  it('passes auth check for AKIMAT (may 404 due to mock)', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(null)
    const res = await patchCrowdfundingById(
      req('http://localhost/api/crowdfunding/camp-1', 'PATCH', { action: 'expire' }, withRole('AKIMAT')),
      { params: campaignParams }
    )
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

describe('GET /api/crowdfunding/[id] — public', () => {
  it('200 with no auth (returns 404 when campaign not in mock)', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(null)
    const res = await getCrowdfundingById(
      req('http://localhost/api/crowdfunding/camp-1', 'GET'),
      { params: campaignParams }
    )
    // Passes auth (no guard), fails 404 — that's expected
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// /api/treasury/[district]
// ─────────────────────────────────────────────────────────────────────────────

const proposalBody = {
  title: 'New park',
  description: 'Build a new park',
  amount: 5000000,
  category: 'LANDSCAPING',
}

const voteBody = {
  proposalId: 'prop-1',
  citizenId: 'citizen-1',
  inFavor: true,
}

describe('POST /api/treasury/[district] — AKIMAT only (create proposal)', () => {
  it('401 with no auth', async () => {
    const res = await postTreasury(
      req('http://localhost/api/treasury/Медеуский', 'POST', proposalBody),
      { params: districtParams }
    )
    expect(res.status).toBe(401)
  })

  it('403 for CITIZEN', async () => {
    const res = await postTreasury(
      req('http://localhost/api/treasury/Медеуский', 'POST', proposalBody, withRole('CITIZEN')),
      { params: districtParams }
    )
    expect(res.status).toBe(403)
  })

  it('403 for CONTRACTOR', async () => {
    const res = await postTreasury(
      req('http://localhost/api/treasury/Медеуский', 'POST', proposalBody, withRole('CONTRACTOR')),
      { params: districtParams }
    )
    expect(res.status).toBe(403)
  })

  it('passes auth check for AKIMAT (may 404 due to mock)', async () => {
    prismaMock.districtTreasury.findUnique.mockResolvedValue(null)
    const res = await postTreasury(
      req('http://localhost/api/treasury/Медеуский', 'POST', proposalBody, withRole('AKIMAT')),
      { params: districtParams }
    )
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

describe('PATCH /api/treasury/[district] — CITIZEN only (vote)', () => {
  it('401 with no auth', async () => {
    const res = await patchTreasury(
      req('http://localhost/api/treasury/Медеуский', 'PATCH', voteBody),
      { params: districtParams }
    )
    expect(res.status).toBe(401)
  })

  it('403 for CONTRACTOR', async () => {
    const res = await patchTreasury(
      req('http://localhost/api/treasury/Медеуский', 'PATCH', voteBody, withRole('CONTRACTOR')),
      { params: districtParams }
    )
    expect(res.status).toBe(403)
  })

  it('403 for AKIMAT', async () => {
    const res = await patchTreasury(
      req('http://localhost/api/treasury/Медеуский', 'PATCH', voteBody, withRole('AKIMAT')),
      { params: districtParams }
    )
    expect(res.status).toBe(403)
  })

  it('passes auth check for CITIZEN (may 409/error due to mock)', async () => {
    prismaMock.proposalVote.findUnique.mockResolvedValue(null)
    prismaMock.$transaction.mockResolvedValue([{}, {}])
    const res = await patchTreasury(
      req('http://localhost/api/treasury/Медеуский', 'PATCH', voteBody, withRole('CITIZEN')),
      { params: districtParams }
    )
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

describe('GET /api/treasury/[district] — public', () => {
  it('200 with no auth (returns 404 when district not in mock)', async () => {
    prismaMock.districtTreasury.findUnique.mockResolvedValue(null)
    const res = await getTreasury(
      req('http://localhost/api/treasury/Медеуский', 'GET'),
      { params: districtParams }
    )
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// /api/jury
// ─────────────────────────────────────────────────────────────────────────────

const commitBody = {
  sessionId: 'session-1',
  citizenId: 'citizen-1',
  commitHash: 'abc123',
}

const revealBody = {
  sessionId: 'session-1',
  citizenId: 'citizen-1',
  vote: 'ACCEPT',
  salt: 'random-salt',
}

describe('POST /api/jury — CITIZEN only (commit vote)', () => {
  it('401 with no auth', async () => {
    const res = await postJury(req('http://localhost/api/jury', 'POST', commitBody))
    expect(res.status).toBe(401)
  })

  it('403 for CONTRACTOR', async () => {
    const res = await postJury(
      req('http://localhost/api/jury', 'POST', commitBody, withRole('CONTRACTOR'))
    )
    expect(res.status).toBe(403)
  })

  it('403 for AKIMAT', async () => {
    const res = await postJury(
      req('http://localhost/api/jury', 'POST', commitBody, withRole('AKIMAT'))
    )
    expect(res.status).toBe(403)
  })

  it('passes auth check for CITIZEN (may 403 "not a juror" due to mock)', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue(null)
    const res = await postJury(
      req('http://localhost/api/jury', 'POST', commitBody, withRole('CITIZEN'))
    )
    // The route's own business logic may return 403 ("Not a juror") — that's different from requireRole
    // We just verify it isn't a requireRole 401
    expect(res.status).not.toBe(401)
  })
})

describe('PATCH /api/jury — CITIZEN only (reveal vote)', () => {
  it('401 with no auth', async () => {
    const res = await patchJury(req('http://localhost/api/jury', 'PATCH', revealBody))
    expect(res.status).toBe(401)
  })

  it('403 for CONTRACTOR', async () => {
    const res = await patchJury(
      req('http://localhost/api/jury', 'PATCH', revealBody, withRole('CONTRACTOR'))
    )
    expect(res.status).toBe(403)
  })

  it('403 for AKIMAT', async () => {
    const res = await patchJury(
      req('http://localhost/api/jury', 'PATCH', revealBody, withRole('AKIMAT'))
    )
    expect(res.status).toBe(403)
  })

  it('passes auth check for CITIZEN (may fail at "not a juror" — not requireRole)', async () => {
    prismaMock.juryVote.findFirst.mockResolvedValue(null)
    const res = await patchJury(
      req('http://localhost/api/jury', 'PATCH', revealBody, withRole('CITIZEN'))
    )
    expect(res.status).not.toBe(401)
  })
})

describe('GET /api/jury — public', () => {
  it('200 with no auth (returns sessions list)', async () => {
    prismaMock.jurySession.findMany.mockResolvedValue([])
    const res = await getJury(req('http://localhost/api/jury', 'GET'))
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// /api/work-logs
// ─────────────────────────────────────────────────────────────────────────────

const workLogBody = {
  contractId: 'contract-1',
  contractorId: 'contractor-1',
  type: 'DAILY_REPORT',
  title: 'Day 1',
  description: 'Work started',
  completionPct: 10,
  gpsLat: 43.25,
  gpsLng: 76.91,
}

describe('POST /api/work-logs — CONTRACTOR or AKIMAT only', () => {
  it('401 with no auth', async () => {
    const res = await postWorkLogs(req('http://localhost/api/work-logs', 'POST', workLogBody))
    expect(res.status).toBe(401)
  })

  it('403 for CITIZEN', async () => {
    const res = await postWorkLogs(
      req('http://localhost/api/work-logs', 'POST', workLogBody, withRole('CITIZEN'))
    )
    expect(res.status).toBe(403)
  })

  it('201 for CONTRACTOR', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({ id: 'contract-1', lat: 43.25, lng: 76.91 } as any)
    prismaMock.workLog.create.mockResolvedValue({ id: 'log-1', ...workLogBody, gpsValid: true } as any)
    const res = await postWorkLogs(
      req('http://localhost/api/work-logs', 'POST', workLogBody, withRole('CONTRACTOR'))
    )
    expect(res.status).toBe(201)
  })

  it('201 for AKIMAT', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({ id: 'contract-1', lat: 43.25, lng: 76.91 } as any)
    prismaMock.workLog.create.mockResolvedValue({ id: 'log-1', ...workLogBody, gpsValid: true } as any)
    const res = await postWorkLogs(
      req('http://localhost/api/work-logs', 'POST', workLogBody, withRole('AKIMAT'))
    )
    expect(res.status).toBe(201)
  })

  it('201 for CONTRACTOR via Bearer token', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({ id: 'contract-1', lat: 43.25, lng: 76.91 } as any)
    prismaMock.workLog.create.mockResolvedValue({ id: 'log-1', ...workLogBody, gpsValid: true } as any)
    const res = await postWorkLogs(
      req('http://localhost/api/work-logs', 'POST', workLogBody, bearerToken('CONTRACTOR'))
    )
    expect(res.status).toBe(201)
  })
})

describe('GET /api/work-logs — public', () => {
  it('400 without contractId (public, no auth required)', async () => {
    const res = await getWorkLogs(req('http://localhost/api/work-logs', 'GET'))
    expect(res.status).toBe(400)
    expect(res.status).not.toBe(401)
  })

  it('200 with contractId and no auth', async () => {
    prismaMock.workLog.findMany.mockResolvedValue([])
    const res = await getWorkLogs(
      new NextRequest('http://localhost/api/work-logs?contractId=contract-1')
    )
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// /api/citizens
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/citizens — AKIMAT only (update reputation)', () => {
  it('401 with no auth', async () => {
    const res = await patchCitizens(
      req('http://localhost/api/citizens', 'PATCH', { walletAddress: 'addr', reputationDelta: 10 })
    )
    expect(res.status).toBe(401)
  })

  it('403 for CITIZEN', async () => {
    const res = await patchCitizens(
      req('http://localhost/api/citizens', 'PATCH',
        { walletAddress: 'addr', reputationDelta: 10 },
        withRole('CITIZEN')
      )
    )
    expect(res.status).toBe(403)
  })

  it('403 for CONTRACTOR', async () => {
    const res = await patchCitizens(
      req('http://localhost/api/citizens', 'PATCH',
        { walletAddress: 'addr', reputationDelta: 10 },
        withRole('CONTRACTOR')
      )
    )
    expect(res.status).toBe(403)
  })

  it('200 for AKIMAT', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue({
      id: 'c1', walletAddress: 'addr', reputationScore: 100, tier: 'ACTIVE',
    } as any)
    prismaMock.citizen.update.mockResolvedValue({
      id: 'c1', walletAddress: 'addr', reputationScore: 110, tier: 'ACTIVE',
    } as any)
    const res = await patchCitizens(
      req('http://localhost/api/citizens', 'PATCH',
        { walletAddress: 'addr', reputationDelta: 10 },
        withRole('AKIMAT')
      )
    )
    expect(res.status).toBe(200)
  })
})

describe('GET /api/citizens — public', () => {
  it('200 list with no auth', async () => {
    prismaMock.citizen.findMany.mockResolvedValue([])
    const res = await getCitizens(new NextRequest('http://localhost/api/citizens'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/citizens — public registration', () => {
  it('201 with no auth (open registration)', async () => {
    prismaMock.citizen.findFirst.mockResolvedValue(null)
    prismaMock.citizen.create.mockResolvedValue({
      id: 'c1', walletAddress: 'new-wallet', district: 'Медеуский', iinHash: 'hash',
    } as any)
    const res = await postCitizens(
      req('http://localhost/api/citizens', 'POST', {
        walletAddress: 'new-wallet',
        district: 'Медеуский',
        iinHash: 'hash',
      })
    )
    expect(res.status).toBe(201)
  })
})
