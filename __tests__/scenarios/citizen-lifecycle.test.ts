import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { prismaMock, resetPrismaMock } from '../mocks/prisma'

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/web3/fetchDistrictTreasuryBalance', () => ({
  fetchDistrictTreasuryBalanceOnChain: vi.fn().mockResolvedValue(null),
  getReadOnlySolanaConnection: vi.fn(),
}))

vi.mock('@/lib/adl-token', () => ({
  mintAdlTo: vi.fn().mockResolvedValue('mock-signature'),
  isAdlConfigured: vi.fn().mockReturnValue(true),
}))

// ---------------------------------------------------------------------------
// Route imports (top-level await — vitest supports ESM)
// ---------------------------------------------------------------------------
const { GET: CitizensGET, POST: CitizensPOST, PATCH: CitizensPATCH } =
  await import('@/app/api/citizens/route')

const { GET: JuryGET, POST: JuryPOST, PATCH: JuryPATCH } =
  await import('@/app/api/jury/route')

const { POST: TokenPOST } = await import('@/app/api/tokens/award/route')

const { PATCH: TreasuryPATCH } = await import('@/app/api/treasury/[district]/route')

const { POST: CrowdfundPOST } = await import('@/app/api/crowdfunding/[id]/route')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CITIZEN_WALLET = '3zuYfqNAXFy8RYYSo6guiXXRPNc1hTvw7CFiLUnXoQWp'

/** Row returned by resolveSessionForMutation (jurySession.findUnique with sessionInclude). */
function openSessionRow(overrides?: Record<string, unknown>) {
  return {
    id: 's1',
    status: 'COMMIT_PHASE' as const,
    commitDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
    revealDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
    contractId: 'contract1',
    milestoneId: 'm1',
    contract: { id: 'contract1', title: 'T', district: 'D', onChainPubkey: null as string | null },
    milestone: { id: 'm1', description: 'Milestone A' },
    votes: [] as unknown[],
    ...overrides,
  }
}

function citizenHeaders(): HeadersInit {
  const token = Buffer.from(
    JSON.stringify({ role: 'CITIZEN', id: CITIZEN_WALLET }),
  ).toString('base64')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

function makeDistrictParams(district: string) {
  return Promise.resolve({ district })
}

function makeCampaignParams(id: string) {
  return Promise.resolve({ id })
}

// ---------------------------------------------------------------------------
beforeEach(() => resetPrismaMock())
// ---------------------------------------------------------------------------

// =========================================================================
// C1 — Citizen Registration
// =========================================================================
describe('C1. Citizen Registration (POST /api/citizens)', () => {
  it('registers a new citizen with walletAddress, district and iinHash', async () => {
    // findFirst returns null → no duplicate
    prismaMock.citizen.findFirst.mockResolvedValue(null)
    prismaMock.citizen.create.mockResolvedValue({
      id: 'cit-1',
      walletAddress: CITIZEN_WALLET,
      district: 'Almaly',
      iinHash: 'abc123',
      reputationScore: 0,
      tier: 'NEW',
    })

    const res = await CitizensPOST(
      new NextRequest('http://localhost/api/citizens', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: CITIZEN_WALLET,
          district: 'Almaly',
          iinHash: 'abc123',
        }),
      }),
    )
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.walletAddress).toBe(CITIZEN_WALLET)
  })

  it('rejects duplicate walletAddress with 409', async () => {
    prismaMock.citizen.findFirst.mockResolvedValue({
      id: 'existing',
      walletAddress: CITIZEN_WALLET,
      district: 'Almaly',
      iinHash: 'old-hash',
    })

    const res = await CitizensPOST(
      new NextRequest('http://localhost/api/citizens', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: CITIZEN_WALLET,
          district: 'Almaly',
          iinHash: 'new-hash',
        }),
      }),
    )
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('Wallet already registered')
  })

  it('rejects duplicate iinHash with 409', async () => {
    prismaMock.citizen.findFirst.mockResolvedValue({
      id: 'existing',
      walletAddress: 'DifferentWallet1234567890123456789012',
      district: 'Almaly',
      iinHash: 'duplicate-iin',
    })

    const res = await CitizensPOST(
      new NextRequest('http://localhost/api/citizens', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: CITIZEN_WALLET,
          district: 'Almaly',
          iinHash: 'duplicate-iin',
        }),
      }),
    )
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('IIN already registered')
  })

  describe('reputation tiers via PATCH', () => {
    const tiers: Array<{ delta: number; expectedScore: number; expectedTier: string }> = [
      { delta: 30, expectedScore: 30, expectedTier: 'NEW' },       // 0-49
      { delta: 80, expectedScore: 80, expectedTier: 'ACTIVE' },    // 50-149
      { delta: 200, expectedScore: 200, expectedTier: 'TRUSTED' }, // 150-299
      { delta: 350, expectedScore: 350, expectedTier: 'GUARDIAN' }, // 300+
    ]

    for (const { delta, expectedScore, expectedTier } of tiers) {
      it(`score ${expectedScore} → tier ${expectedTier}`, async () => {
        prismaMock.citizen.findUnique.mockResolvedValue({
          id: 'cit-1',
          walletAddress: CITIZEN_WALLET,
          reputationScore: 0,
          tier: 'NEW',
        })
        prismaMock.citizen.update.mockResolvedValue({
          id: 'cit-1',
          walletAddress: CITIZEN_WALLET,
          reputationScore: expectedScore,
          tier: expectedTier,
        })

        const res = await CitizensPATCH(
          new NextRequest('http://localhost/api/citizens', {
            method: 'PATCH',
            body: JSON.stringify({ walletAddress: CITIZEN_WALLET, reputationDelta: delta }),
          }),
        )
        expect(res.status).toBe(200)

        // Verify update was called with correct tier
        expect(prismaMock.citizen.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              reputationScore: expectedScore,
              tier: expectedTier,
            }),
          }),
        )
      })
    }
  })

  it('GET by wallet returns citizen data', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue({
      id: 'cit-1',
      walletAddress: CITIZEN_WALLET,
      district: 'Almaly',
      reputationScore: 150,
      tier: 'TRUSTED',
      nfts: [],
      juryVotes: [],
    })

    const res = await CitizensGET(
      new NextRequest(`http://localhost/api/citizens?wallet=${CITIZEN_WALLET}`),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.walletAddress).toBe(CITIZEN_WALLET)
    expect(data.tier).toBe('TRUSTED')
  })

  it('GET returns 404 for unknown wallet', async () => {
    prismaMock.citizen.findUnique.mockResolvedValue(null)

    const res = await CitizensGET(
      new NextRequest('http://localhost/api/citizens?wallet=UnknownWallet123'),
    )
    expect(res.status).toBe(404)
  })
})

// =========================================================================
// C2 — Jury Commit-Reveal Full Cycle
// =========================================================================
describe('C2. Jury Commit-Reveal Full Cycle', () => {
  beforeEach(() => {
    // Standard enrichment mocks used by GET and internally by resolveJuryCitizenId
    prismaMock.milestone.findMany.mockResolvedValue([{ id: 'm1' }])
    prismaMock.workLog.findFirst.mockResolvedValue({ photoHashes: ['QmTest123'] })
    // citizen.findUnique is called with two different patterns:
    //   { where: { walletAddress } } → returns { id: 'c1' } (auth lookup)
    //   { where: { id } } → returns { id: 'c1', isEligible: true, banUntil: null } (eligibility)
    prismaMock.citizen.findUnique.mockImplementation((args: any) => {
      if (args?.where?.walletAddress) return Promise.resolve({ id: 'c1' })
      if (args?.where?.id) return Promise.resolve({ id: 'c1', isEligible: true, banUntil: null })
      return Promise.resolve(null)
    })
  })

  // --- Commit phase ---
  describe('POST /api/jury (commit)', () => {
    it('commits vote with valid hash -> 200', async () => {
      const commitHash = createHash('sha256').update('accept:mysalt').digest('hex')

      prismaMock.jurySession.findUnique.mockResolvedValue(openSessionRow())
      prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: null })
      prismaMock.juryVote.update.mockResolvedValue({ id: 'v1', commitHash })

      const res = await JuryPOST(
        new NextRequest('http://localhost/api/jury', {
          method: 'POST',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', commitHash }),
        }),
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.commitHash).toBe(commitHash)
    })

    it('returns 403 for non-juror (findFirst returns null, citizen not eligible)', async () => {
      prismaMock.jurySession.findUnique.mockResolvedValue(openSessionRow())
      prismaMock.juryVote.findFirst.mockResolvedValue(null)
      // Override citizen mock: wallet lookup succeeds but eligibility check fails
      prismaMock.citizen.findUnique.mockImplementation((args: any) => {
        if (args?.where?.walletAddress) return Promise.resolve({ id: 'c1' })
        if (args?.where?.id) return Promise.resolve({ id: 'c1', isEligible: false, banUntil: null })
        return Promise.resolve(null)
      })

      const res = await JuryPOST(
        new NextRequest('http://localhost/api/jury', {
          method: 'POST',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', commitHash: 'anyhash' }),
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 401 without auth', async () => {
      const res = await JuryPOST(
        new NextRequest('http://localhost/api/jury', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: 's1', commitHash: 'anyhash' }),
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when citizen ID is not a Solana wallet', async () => {
      const token = Buffer.from(
        JSON.stringify({ role: 'CITIZEN', id: 'demo-citizen-1' }),
      ).toString('base64')

      const res = await JuryPOST(
        new NextRequest('http://localhost/api/jury', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionId: 's1', commitHash: 'anyhash' }),
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 409 if already committed', async () => {
      prismaMock.jurySession.findUnique.mockResolvedValue(openSessionRow())
      prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: 'already-committed' })

      const res = await JuryPOST(
        new NextRequest('http://localhost/api/jury', {
          method: 'POST',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', commitHash: 'newhash' }),
        }),
      )
      expect(res.status).toBe(409)
    })
  })

  // --- Reveal phase ---
  describe('PATCH /api/jury (reveal)', () => {
    it('reveal with correct hash -> 200, session finalized as ACCEPTED', async () => {
      const vote = 'accept'
      const salt = 'mysalt'
      const commitHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')

      prismaMock.juryVote.findFirst.mockResolvedValue({
        id: 'v1',
        commitHash,
        revealedVote: null,
        weight: 1,
      })
      prismaMock.juryVote.update.mockResolvedValue({
        id: 'v1',
        revealedVote: 'ACCEPT',
        revealedSalt: salt,
      })
      prismaMock.juryVote.findUnique.mockResolvedValue({ id: 'v1' })
      // All votes revealed with accept -> weightedAccept >= 1 -> early accept
      prismaMock.juryVote.findMany.mockResolvedValue([
        { revealedVote: 'ACCEPT', weight: 1 },
      ])
      // First call: resolveSessionForMutation; second call: sessionMeta
      prismaMock.jurySession.findUnique
        .mockResolvedValueOnce(openSessionRow())
        .mockResolvedValueOnce({
          status: 'COMMIT_PHASE',
          milestoneId: 'm1',
          contractId: 'contract1',
        })
      prismaMock.jurySession.update.mockResolvedValue({ id: 's1' })
      prismaMock.milestone.update.mockResolvedValue({ id: 'm1', tranchePct: 30 })
      prismaMock.contract.findUnique.mockResolvedValue({
        id: 'contract1', totalAmount: BigInt(100_000_000), escrowAmount: BigInt(20_000_000), paidAmount: BigInt(0),
        milestones: [{ id: 'm1', status: 'ACCEPTED' }],
      })
      prismaMock.contract.update.mockResolvedValue({ id: 'contract1', escrowAmount: BigInt(0), paidAmount: BigInt(30_000_000) })

      const res = await JuryPATCH(
        new NextRequest('http://localhost/api/jury', {
          method: 'PATCH',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', vote, salt }),
        }),
      )
      expect(res.status).toBe(200)

      // Verify session was finalized
      expect(prismaMock.jurySession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FINALIZED',
            result: 'ACCEPT',
          }),
        }),
      )
      // Verify milestone set to ACCEPTED
      expect(prismaMock.milestone.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm1' },
          data: { status: 'ACCEPTED' },
        }),
      )
    })

    it('reveal with WRONG hash -> 400 (vote manipulation detection)', async () => {
      const commitHash = createHash('sha256').update('reject:originalsalt').digest('hex')

      prismaMock.jurySession.findUnique.mockResolvedValueOnce(openSessionRow())
      prismaMock.juryVote.findFirst.mockResolvedValue({
        id: 'v1',
        commitHash,
        revealedVote: null,
      })

      const res = await JuryPATCH(
        new NextRequest('http://localhost/api/jury', {
          method: 'PATCH',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', vote: 'accept', salt: 'differentsalt' }),
        }),
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Hash mismatch')
    })

    it('400 if not yet committed (commitHash is null)', async () => {
      prismaMock.jurySession.findUnique.mockResolvedValueOnce(openSessionRow())
      prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: null })

      const res = await JuryPATCH(
        new NextRequest('http://localhost/api/jury', {
          method: 'PATCH',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', vote: 'accept', salt: 'anysalt' }),
        }),
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Must commit before reveal')
    })

    it('expert vote (weight=2) vs citizen vote (weight=1) affects weighted tally', async () => {
      const vote = 'reject'
      const salt = 'expertsalt'
      const commitHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')

      prismaMock.juryVote.findFirst.mockResolvedValue({
        id: 'v-expert',
        commitHash,
        revealedVote: null,
        weight: 2,
        isExpert: true,
      })
      prismaMock.juryVote.update.mockResolvedValue({
        id: 'v-expert',
        revealedVote: 'REJECT',
        revealedSalt: salt,
      })
      prismaMock.juryVote.findUnique.mockResolvedValue({ id: 'v-expert' })

      // Expert(w=2) REJECT + citizen(w=1) ACCEPT = weightedAccept=1, weightedReject=2
      // earlyAccept: weightedAccept >= 1 -> true, so still ACCEPT
      // The route uses earlyAccept = weightedAccept >= 1
      prismaMock.juryVote.findMany.mockResolvedValue([
        { revealedVote: 'REJECT', weight: 2 },
        { revealedVote: 'ACCEPT', weight: 1 },
      ])
      // First call: resolveSessionForMutation; second call: sessionMeta
      prismaMock.jurySession.findUnique
        .mockResolvedValueOnce(openSessionRow())
        .mockResolvedValueOnce({
          status: 'REVEAL_PHASE',
          milestoneId: 'm1',
          contractId: 'contract1',
        })
      prismaMock.jurySession.update.mockResolvedValue({ id: 's1' })
      prismaMock.milestone.update.mockResolvedValue({ id: 'm1', tranchePct: 30 })
      prismaMock.contract.findUnique.mockResolvedValue({
        id: 'contract1', totalAmount: BigInt(100_000_000), escrowAmount: BigInt(20_000_000), paidAmount: BigInt(0),
        milestones: [{ id: 'm1', status: 'ACCEPTED' }],
      })
      prismaMock.contract.update.mockResolvedValue({ id: 'contract1', escrowAmount: BigInt(0), paidAmount: BigInt(30_000_000) })

      const res = await JuryPATCH(
        new NextRequest('http://localhost/api/jury', {
          method: 'PATCH',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', vote, salt }),
        }),
      )
      expect(res.status).toBe(200)

      // weightedReject(2) > weightedAccept(1) -> REJECT
      expect(prismaMock.jurySession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FINALIZED',
            result: 'REJECT',
            weightedAccept: 1,
            weightedReject: 2,
          }),
        }),
      )
    })

    it('accept result: weightedAccept > weightedReject -> milestone ACCEPTED', async () => {
      const vote = 'accept'
      const salt = 'salt1'
      const commitHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')

      prismaMock.juryVote.findFirst.mockResolvedValue({
        id: 'v1',
        commitHash,
        revealedVote: null,
        weight: 1,
      })
      prismaMock.juryVote.update.mockResolvedValue({ id: 'v1', revealedVote: 'ACCEPT' })
      prismaMock.juryVote.findUnique.mockResolvedValue({ id: 'v1' })
      prismaMock.juryVote.findMany.mockResolvedValue([
        { revealedVote: 'ACCEPT', weight: 2 },
        { revealedVote: 'REJECT', weight: 1 },
      ])
      // First call: resolveSessionForMutation; second call: sessionMeta
      prismaMock.jurySession.findUnique
        .mockResolvedValueOnce(openSessionRow())
        .mockResolvedValueOnce({
          status: 'COMMIT_PHASE',
          milestoneId: 'm1',
          contractId: 'contract1',
        })
      prismaMock.jurySession.update.mockResolvedValue({ id: 's1' })
      prismaMock.milestone.update.mockResolvedValue({ id: 'm1', tranchePct: 30 })
      prismaMock.contract.findUnique.mockResolvedValue({
        id: 'contract1', totalAmount: BigInt(100_000_000), escrowAmount: BigInt(20_000_000), paidAmount: BigInt(0),
        milestones: [{ id: 'm1', status: 'ACCEPTED' }],
      })
      prismaMock.contract.update.mockResolvedValue({ id: 'contract1', escrowAmount: BigInt(0), paidAmount: BigInt(30_000_000) })

      const res = await JuryPATCH(
        new NextRequest('http://localhost/api/jury', {
          method: 'PATCH',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', vote, salt }),
        }),
      )
      expect(res.status).toBe(200)
      expect(prismaMock.milestone.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'ACCEPTED' },
        }),
      )
    })

    it('reject result: all revealed, weighted reject majority, no early accept', async () => {
      const vote = 'reject'
      const salt = 'saltr'
      const commitHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')

      prismaMock.juryVote.findFirst.mockResolvedValue({
        id: 'v1',
        commitHash,
        revealedVote: null,
        weight: 1,
      })
      prismaMock.juryVote.update.mockResolvedValue({ id: 'v1', revealedVote: 'REJECT' })
      prismaMock.juryVote.findUnique.mockResolvedValue({ id: 'v1' })
      // All revealed: 0 accept, 3 reject -> weightedAccept=0, weightedReject=3 -> REJECT
      prismaMock.juryVote.findMany.mockResolvedValue([
        { revealedVote: 'REJECT', weight: 1 },
        { revealedVote: 'REJECT', weight: 1 },
        { revealedVote: 'REJECT', weight: 1 },
      ])
      // First call: resolveSessionForMutation; second call: sessionMeta
      prismaMock.jurySession.findUnique
        .mockResolvedValueOnce(openSessionRow())
        .mockResolvedValueOnce({
          status: 'REVEAL_PHASE',
          milestoneId: 'm1',
          contractId: 'contract1',
        })
      prismaMock.jurySession.update.mockResolvedValue({ id: 's1' })
      prismaMock.milestone.update.mockResolvedValue({ id: 'm1', tranchePct: 30 })
      prismaMock.contract.findUnique.mockResolvedValue({
        id: 'contract1', totalAmount: BigInt(100_000_000), escrowAmount: BigInt(20_000_000), paidAmount: BigInt(0),
        milestones: [{ id: 'm1', status: 'ACCEPTED' }],
      })
      prismaMock.contract.update.mockResolvedValue({ id: 'contract1', escrowAmount: BigInt(0), paidAmount: BigInt(30_000_000) })

      const res = await JuryPATCH(
        new NextRequest('http://localhost/api/jury', {
          method: 'PATCH',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', vote, salt }),
        }),
      )
      expect(res.status).toBe(200)
      expect(prismaMock.jurySession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FINALIZED',
            result: 'REJECT',
          }),
        }),
      )
      expect(prismaMock.milestone.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'REJECTED' },
        }),
      )
    })

    it('full commit-reveal cycle: commit then reveal successfully', async () => {
      const vote = 'accept'
      const salt = 'mysecretSalt42'
      const commitHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')

      // Step 1: Commit
      prismaMock.jurySession.findUnique.mockResolvedValue(openSessionRow())
      prismaMock.juryVote.findFirst.mockResolvedValue({ id: 'v1', commitHash: null })
      prismaMock.juryVote.update.mockResolvedValue({ id: 'v1', commitHash })

      const commitRes = await JuryPOST(
        new NextRequest('http://localhost/api/jury', {
          method: 'POST',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', commitHash }),
        }),
      )
      expect(commitRes.status).toBe(200)

      // Step 2: Reveal
      resetPrismaMock()
      prismaMock.milestone.findMany.mockResolvedValue([{ id: 'm1' }])
      prismaMock.workLog.findFirst.mockResolvedValue({ photoHashes: ['QmTest123'] })
      prismaMock.citizen.findUnique.mockImplementation((args: any) => {
        if (args?.where?.walletAddress) return Promise.resolve({ id: 'c1' })
        if (args?.where?.id) return Promise.resolve({ id: 'c1', isEligible: true, banUntil: null })
        return Promise.resolve(null)
      })
      prismaMock.juryVote.findFirst.mockResolvedValue({
        id: 'v1',
        commitHash,
        revealedVote: null,
        weight: 1,
      })
      prismaMock.juryVote.update.mockResolvedValue({
        id: 'v1',
        revealedVote: 'ACCEPT',
        revealedSalt: salt,
      })
      prismaMock.juryVote.findUnique.mockResolvedValue({ id: 'v1' })
      prismaMock.juryVote.findMany.mockResolvedValue([
        { revealedVote: 'ACCEPT', weight: 1 },
      ])
      // First call: resolveSessionForMutation; second call: sessionMeta
      prismaMock.jurySession.findUnique
        .mockResolvedValueOnce(openSessionRow())
        .mockResolvedValueOnce({
          status: 'COMMIT_PHASE',
          milestoneId: 'm1',
          contractId: 'contract1',
        })
      prismaMock.jurySession.update.mockResolvedValue({ id: 's1' })
      prismaMock.milestone.update.mockResolvedValue({ id: 'm1', tranchePct: 30 })
      prismaMock.contract.findUnique.mockResolvedValue({
        id: 'contract1', totalAmount: BigInt(100_000_000), escrowAmount: BigInt(20_000_000), paidAmount: BigInt(0),
        milestones: [{ id: 'm1', status: 'ACCEPTED' }],
      })
      prismaMock.contract.update.mockResolvedValue({ id: 'contract1', escrowAmount: BigInt(0), paidAmount: BigInt(30_000_000) })

      const revealRes = await JuryPATCH(
        new NextRequest('http://localhost/api/jury', {
          method: 'PATCH',
          headers: citizenHeaders(),
          body: JSON.stringify({ sessionId: 's1', vote, salt }),
        }),
      )
      expect(revealRes.status).toBe(200)
      expect(prismaMock.jurySession.update).toHaveBeenCalled()
    })
  })
})

// =========================================================================
// C3 — Token Rewards (ADL)
// =========================================================================
describe('C3. Token Rewards (POST /api/tokens/award)', () => {
  const actionAmounts: Array<{ action: string; amount: number }> = [
    { action: 'registration', amount: 100 },
    { action: 'jury_vote', amount: 25 },
    { action: 'jury_reveal', amount: 25 },
    { action: 'crowdfunding_donation', amount: 15 },
    { action: 'treasury_vote', amount: 20 },
    { action: 'contract_report', amount: 30 },
    { action: 'daily_login', amount: 5 },
    { action: 'proposal_created', amount: 50 },
  ]

  for (const { action, amount } of actionAmounts) {
    it(`${action} -> ${amount} ADL`, async () => {
      const res = await TokenPOST(
        new NextRequest('http://localhost/api/tokens/award', {
          method: 'POST',
          body: JSON.stringify({ action, walletAddress: CITIZEN_WALLET }),
        }),
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.amount).toBe(amount)
      expect(data.signature).toBe('mock-signature')
    })
  }

  it('invalid action -> 400', async () => {
    const res = await TokenPOST(
      new NextRequest('http://localhost/api/tokens/award', {
        method: 'POST',
        body: JSON.stringify({ action: 'nonexistent_action', walletAddress: CITIZEN_WALLET }),
      }),
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Invalid action')
  })

  it('missing walletAddress -> 400', async () => {
    const res = await TokenPOST(
      new NextRequest('http://localhost/api/tokens/award', {
        method: 'POST',
        body: JSON.stringify({ action: 'registration' }),
      }),
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('walletAddress required')
  })

  it('ADL not configured -> 503', async () => {
    const { isAdlConfigured } = await import('@/lib/adl-token')
    ;(isAdlConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false)

    const res = await TokenPOST(
      new NextRequest('http://localhost/api/tokens/award', {
        method: 'POST',
        body: JSON.stringify({ action: 'registration', walletAddress: CITIZEN_WALLET }),
      }),
    )
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toContain('ADL token not configured')

    // Restore for other tests
    ;(isAdlConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true)
  })
})

// =========================================================================
// C4 — Treasury Proposal Voting
// =========================================================================
describe('C4. Treasury Proposal Voting (PATCH /api/treasury/[district])', () => {
  it('vote in favor -> proposalVote created, votesFor incremented', async () => {
    prismaMock.proposalVote.findUnique.mockResolvedValue(null) // no existing vote
    prismaMock.proposalVote.create.mockResolvedValue({
      id: 'pv1',
      proposalId: 'p1',
      citizenId: 'c1',
      inFavor: true,
    })
    prismaMock.spendingProposal.update.mockResolvedValue({
      id: 'p1',
      votesFor: 1,
      votesAgainst: 0,
    })

    const res = await TreasuryPATCH(
      new NextRequest('http://localhost/api/treasury/test', {
        method: 'PATCH',
        body: JSON.stringify({
          proposalId: 'p1',
          citizenId: 'c1',
          inFavor: true,
          txSignature: 'tx-sig-123',
        }),
      }),
      { params: makeDistrictParams('Ауэзовский') },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.vote).toBeDefined()
    expect(data.proposal).toBeDefined()
  })

  it('vote against -> votesAgainst incremented', async () => {
    prismaMock.proposalVote.findUnique.mockResolvedValue(null)
    prismaMock.proposalVote.create.mockResolvedValue({
      id: 'pv2',
      proposalId: 'p1',
      citizenId: 'c1',
      inFavor: false,
    })
    prismaMock.spendingProposal.update.mockResolvedValue({
      id: 'p1',
      votesFor: 0,
      votesAgainst: 1,
    })

    const res = await TreasuryPATCH(
      new NextRequest('http://localhost/api/treasury/test', {
        method: 'PATCH',
        body: JSON.stringify({
          proposalId: 'p1',
          citizenId: 'c1',
          inFavor: false,
          txSignature: 'tx-sig-456',
        }),
      }),
      { params: makeDistrictParams('Ауэзовский') },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.proposal.votesAgainst).toBe(1)
  })

  it('duplicate vote -> 409', async () => {
    prismaMock.proposalVote.findUnique.mockResolvedValue({
      id: 'existing-vote',
      proposalId: 'p1',
      citizenId: 'c1',
    })

    const res = await TreasuryPATCH(
      new NextRequest('http://localhost/api/treasury/test', {
        method: 'PATCH',
        body: JSON.stringify({
          proposalId: 'p1',
          citizenId: 'c1',
          inFavor: true,
          txSignature: 'tx-sig-789',
        }),
      }),
      { params: makeDistrictParams('Ауэзовский') },
    )
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('Already voted')
  })

  it('missing txSignature -> 400', async () => {
    const res = await TreasuryPATCH(
      new NextRequest('http://localhost/api/treasury/test', {
        method: 'PATCH',
        body: JSON.stringify({
          proposalId: 'p1',
          citizenId: 'c1',
          inFavor: true,
        }),
      }),
      { params: makeDistrictParams('Ауэзовский') },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('On-chain confirmation')
  })
})

// =========================================================================
// C5 — Crowdfunding Contribution
// =========================================================================
describe('C5. Crowdfunding Contribution (POST /api/crowdfunding/[id])', () => {
  const activeCampaign = {
    id: 'campaign1',
    status: 'ACTIVE',
    citizenTarget: BigInt(1_000_000),
    citizenRaised: BigInt(500_000),
    stateMatch: BigInt(9_000_000),
    goal: BigInt(10_000_000),
    district: 'Ауэзовский',
    category: 'PLAYGROUND',
    deadline: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    title: 'Детская площадка',
    donorCount: 5,
    contractId: null,
  }

  it('contribute 10,000 tenge -> 201, contribution created', async () => {
    prismaMock.crowdfundingCampaign.findUnique
      .mockResolvedValueOnce(activeCampaign)
      .mockResolvedValueOnce({
        ...activeCampaign,
        citizenRaised: BigInt(510_000),
        donorCount: 6,
      })
    prismaMock.citizen.findUnique.mockResolvedValue({ id: 'c1' })
    prismaMock.campaignContribution.create.mockResolvedValue({
      id: 'contrib-1',
      campaignId: 'campaign1',
      citizenId: 'c1',
      amount: BigInt(10_000),
    })
    prismaMock.crowdfundingCampaign.update.mockResolvedValue({
      ...activeCampaign,
      citizenRaised: BigInt(510_000),
      donorCount: 6,
    })

    const res = await CrowdfundPOST(
      new NextRequest('http://localhost/api/crowdfunding/campaign1', {
        method: 'POST',
        body: JSON.stringify({
          citizenId: 'c1',
          amount: 10_000,
          anonymous: false,
          txSignature: 'tx-sig-cf',
        }),
      }),
      { params: makeCampaignParams('campaign1') },
    )
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.contribution).toBeDefined()
    expect(data.campaign).toBeDefined()
  })

  it('reject < 500 tenge -> 400', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(activeCampaign)

    const res = await CrowdfundPOST(
      new NextRequest('http://localhost/api/crowdfunding/campaign1', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 100, anonymous: false }),
      }),
      { params: makeCampaignParams('campaign1') },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Minimum contribution')
  })

  it('reject > 500,000 tenge -> 400', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(activeCampaign)

    const res = await CrowdfundPOST(
      new NextRequest('http://localhost/api/crowdfunding/campaign1', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 600_000, anonymous: false }),
      }),
      { params: makeCampaignParams('campaign1') },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Maximum contribution')
  })

  it('reject expired campaign -> 400', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue({
      ...activeCampaign,
      deadline: new Date(Date.now() - 86400000), // yesterday
    })

    const res = await CrowdfundPOST(
      new NextRequest('http://localhost/api/crowdfunding/campaign1', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 5_000, anonymous: false }),
      }),
      { params: makeCampaignParams('campaign1') },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('deadline')
  })

  it('reject contribution to non-ACTIVE campaign -> 400', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue({
      ...activeCampaign,
      status: 'FUNDED',
    })

    const res = await CrowdfundPOST(
      new NextRequest('http://localhost/api/crowdfunding/campaign1', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 5_000, anonymous: false }),
      }),
      { params: makeCampaignParams('campaign1') },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('not accepting contributions')
  })

  it('reject when campaign not found -> 404', async () => {
    prismaMock.crowdfundingCampaign.findUnique.mockResolvedValue(null)

    const res = await CrowdfundPOST(
      new NextRequest('http://localhost/api/crowdfunding/nonexistent', {
        method: 'POST',
        body: JSON.stringify({ citizenId: 'c1', amount: 5_000, anonymous: false }),
      }),
      { params: makeCampaignParams('nonexistent') },
    )
    expect(res.status).toBe(404)
  })

  it('reject missing citizenId or amount -> 400', async () => {
    const res = await CrowdfundPOST(
      new NextRequest('http://localhost/api/crowdfunding/campaign1', {
        method: 'POST',
        body: JSON.stringify({ anonymous: false }),
      }),
      { params: makeCampaignParams('campaign1') },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Missing')
  })
})
