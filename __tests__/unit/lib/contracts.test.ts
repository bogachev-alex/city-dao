import { describe, it, expect } from 'vitest'
import {
  normalizeContract,
  getDaysUntilDeadline,
  getContractPinColor,
  formatAmount,
  formatTengeWithCrypto,
  getMilestoneCompletedCount,
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
  it('shows tenge with SOL and USDT equivalents', () => {
    const result = formatTengeWithCrypto(80_000_000) // 80M tenge
    expect(result).toContain('₸')
    expect(result).toContain('SOL')
    expect(result).toContain('USDT')
    expect(result).toContain('1000.0') // 80M / 80k = 1000 SOL
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
