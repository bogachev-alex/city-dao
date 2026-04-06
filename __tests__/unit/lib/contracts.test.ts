import { describe, it, expect } from 'vitest'
import {
  normalizeContract,
  pickJurySessionForMilestone,
  getDaysUntilDeadline,
  getContractPinColor,
  formatAmount,
  formatTengeWithCrypto,
  getCryptoEquivalent,
  getMilestoneCompletedCount,
  getContractExplorerAddress,
  Contract,
} from '@/lib/contracts'

describe('normalizeContract', () => {
  it('preserves full tenge amount without division', () => {
    // BUG FIX: was dividing by 1000, now keeps full amount
    const result = normalizeContract({
      id: '1', title: 'Test', status: 'ACTIVE',
      totalAmount: '250000000', // 250M tenge from DB
      milestones: [],
    })
    expect(result.amount_usdc).toBe(250000000) // NOT 250000
  })

  it('maps Prisma ACTIVE to frontend active', () => {
    const result = normalizeContract({ id: '1', title: 'X', status: 'ACTIVE', milestones: [] })
    expect(result.status).toBe('active')
  })

  it('maps TERMINATED to completed', () => {
    const result = normalizeContract({ id: '1', title: 'X', status: 'TERMINATED', milestones: [] })
    expect(result.status).toBe('completed')
  })

  it('maps nested contractor name', () => {
    const result = normalizeContract({
      id: '1', title: 'X', status: 'ACTIVE',
      contractor: { name: 'ТОО СтройАлматы' },
      milestones: [],
    })
    expect(result.contractor).toBe('ТОО СтройАлматы')
  })

  it('maps milestone statuses from UPPER_CASE', () => {
    const result = normalizeContract({
      id: '1', title: 'X', status: 'ACTIVE',
      milestones: [
        { id: 'm1', description: 'A', deadlineDays: 5, tranchePct: 50, status: 'ACCEPTED' },
        { id: 'm2', description: 'B', deadlineDays: 10, tranchePct: 50, status: 'UNDER_REVIEW' },
      ],
    })
    expect(result.milestones[0].status).toBe('accepted')
    expect(result.milestones[1].status).toBe('under_review')
  })

  it('maps goszakup-style registry fields and startDate to signedAt', () => {
    const result = normalizeContract({
      id: '1',
      title: 'X',
      status: 'ACTIVE',
      registryNumber: '24953097',
      customerName: 'Управление строительства города Алматы',
      subjectType: 'Работа',
      startDate: '2026-03-27T12:00:00.000Z',
      milestones: [],
    })
    expect(result.registryNumber).toBe('24953097')
    expect(result.customerName).toContain('Алматы')
    expect(result.subjectType).toBe('Работа')
    expect(result.signedAt).toBe('2026-03-27T12:00:00.000Z')
  })

  it('maps jury session votes and weights', () => {
    const result = normalizeContract({
      id: '1',
      title: 'X',
      status: 'ACTIVE',
      milestones: [],
      jurySessions: [
        {
          id: 'js1',
          status: 'COMMIT_PHASE',
          result: null,
          milestoneId: 'm1',
          milestone: { description: 'Step' },
          weightedAccept: 0,
          weightedReject: 0,
          votes: [
            {
              commitHash: 'abc',
              revealedVote: null,
              citizen: { walletAddress: '7xKq9fPmAbCdEfGhIjKlMnOpQrStUvWxYz123456789' },
            },
          ],
        },
      ],
    })
    expect(result.jurySessions?.[0].votes?.[0].walletAddress).toContain('7xKq')
    expect(result.jurySessions?.[0].votes?.[0].commitHash).toBe('abc')
  })
})

describe('pickJurySessionForMilestone', () => {
  it('prefers active phase over finalized', () => {
    const s = pickJurySessionForMilestone(
      [
        { id: 'old', status: 'FINALIZED', result: 'ACCEPT', milestoneId: 'm1' },
        { id: 'new', status: 'COMMIT_PHASE', result: null, milestoneId: 'm1', votes: [] },
      ],
      'm1',
    )
    expect(s?.id).toBe('new')
  })
})

describe('getDaysUntilDeadline', () => {
  it('positive for future', () => {
    expect(getDaysUntilDeadline(new Date(Date.now() + 10 * 86400000).toISOString())).toBe(10)
  })
  it('negative for past', () => {
    expect(getDaysUntilDeadline(new Date(Date.now() - 5 * 86400000).toISOString())).toBe(-5)
  })
})

describe('getContractPinColor', () => {
  const base: Contract = {
    id: '1', title: 'X', contractor: 'Y', amount_usdc: 100, district: 'A',
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    status: 'active', lat: 43, lng: 76, escrow_amount: 20, penalty_amount: 0, milestones: [],
  }

  it('completed → checkmark', () => expect(getContractPinColor({ ...base, status: 'completed' })).toBe('checkmark'))
  it('penalized → red', () => expect(getContractPinColor({ ...base, status: 'penalized' })).toBe('red'))
  it('<7 days → yellow', () => expect(getContractPinColor({ ...base, deadline: new Date(Date.now() + 3 * 86400000).toISOString() })).toBe('yellow'))
  it('>7 days → green', () => expect(getContractPinColor(base)).toBe('green'))
})

describe('formatTengeWithCrypto', () => {
  it('shows tenge only (crypto in tooltip)', () => {
    const result = formatTengeWithCrypto(80_000_000) // 80M tenge
    expect(result).toContain('₸')
    expect(result).not.toContain('SOL')
  })
})

describe('getCryptoEquivalent', () => {
  it('shows SOL and USDT equivalents', () => {
    const result = getCryptoEquivalent(80_000_000)
    expect(result).toContain('SOL')
    expect(result).toContain('USDT')
    expect(result).toContain('1000.0')
  })
})

describe('getContractExplorerAddress', () => {
  const minimal = (over: Partial<Contract>): Contract => ({
    id: 'clxid',
    title: 'T',
    contractor: 'C',
    amount_usdc: 1,
    deadline: '',
    district: 'D',
    status: 'active',
    lat: 0,
    lng: 0,
    escrow_amount: 0,
    penalty_amount: 0,
    milestones: [],
    ...over,
  })

  it('uses onChainPubkey when set', () => {
    const pk = 'FPyLxTSo9huzRov1GU8HxwUxNSxXX3ATwHT7MTSi6Khu'
    expect(getContractExplorerAddress(minimal({ onChainPubkey: pk }))).toBe(pk)
  })

  it('uses id when it is a Solana address', () => {
    const pk = 'Dd1hMrmDjKjwxetPb62UmBKLqxWDetGLLxeFJgrn2x3Q'
    expect(getContractExplorerAddress(minimal({ id: pk }))).toBe(pk)
  })

  it('returns null for opaque DB id without pubkey', () => {
    expect(getContractExplorerAddress(minimal({ id: 'cm123abc', onChainPubkey: null }))).toBeNull()
  })
})

describe('getMilestoneCompletedCount', () => {
  it('counts only accepted', () => {
    const contract: Contract = {
      id: '1', title: 'X', contractor: 'Y', amount_usdc: 100, district: 'A',
      deadline: '', status: 'active', lat: 0, lng: 0, escrow_amount: 0, penalty_amount: 0,
      milestones: [
        { id: '1', desc: 'A', deadline_days: 1, tranche_pct: 50, status: 'accepted' },
        { id: '2', desc: 'B', deadline_days: 2, tranche_pct: 50, status: 'pending' },
      ],
    }
    expect(getMilestoneCompletedCount(contract)).toBe(1)
  })
})
