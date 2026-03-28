import { describe, it, expect } from 'vitest'
import {
  normalizeContract,
  getDaysUntilDeadline,
  getContractPinColor,
  formatAmount,
  getMilestoneCompletedCount,
  Contract,
} from '@/lib/contracts'

describe('normalizeContract', () => {
  it('maps Prisma format to frontend Contract', () => {
    const prismaData = {
      id: 'test-1',
      title: 'Test Contract',
      contractor: { name: 'ТОО СтройАлматы' },
      totalAmount: '250000000',
      deadline: '2026-06-01T00:00:00.000Z',
      district: 'Медеуский',
      status: 'ACTIVE',
      lat: 43.27,
      lng: 76.94,
      escrowAmount: '50000000',
      penaltyAmount: '0',
      milestones: [
        { id: 'm1', description: 'Phase 1', deadlineDays: 10, tranchePct: 50, status: 'ACCEPTED' },
        { id: 'm2', description: 'Phase 2', deadlineDays: 20, tranchePct: 50, status: 'PENDING' },
      ],
    }

    const result = normalizeContract(prismaData)
    expect(result.id).toBe('test-1')
    expect(result.title).toBe('Test Contract')
    expect(result.contractor).toBe('ТОО СтройАлматы')
    expect(result.status).toBe('active')
    expect(result.amount_usdc).toBe(250000)
    expect(result.milestones).toHaveLength(2)
    expect(result.milestones[0].status).toBe('accepted')
    expect(result.milestones[1].status).toBe('pending')
    expect(result.milestones[0].desc).toBe('Phase 1')
  })

  it('handles missing contractor gracefully', () => {
    const result = normalizeContract({ id: '1', title: 'X', status: 'ACTIVE', milestones: [] })
    expect(result.contractor).toBe('')
  })

  it('maps TERMINATED status to completed', () => {
    const result = normalizeContract({ id: '1', title: 'X', status: 'TERMINATED', milestones: [] })
    expect(result.status).toBe('completed')
  })
})

describe('getDaysUntilDeadline', () => {
  it('returns positive days for future deadline', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(getDaysUntilDeadline(future)).toBe(10)
  })

  it('returns negative days for past deadline', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(getDaysUntilDeadline(past)).toBe(-5)
  })
})

describe('getContractPinColor', () => {
  const base: Contract = {
    id: '1', title: 'X', contractor: 'Y', amount_usdc: 100, district: 'Медеуский',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active', lat: 43, lng: 76, escrow_amount: 20, penalty_amount: 0, milestones: [],
  }

  it('returns checkmark for completed', () => {
    expect(getContractPinColor({ ...base, status: 'completed' })).toBe('checkmark')
  })

  it('returns red for penalized', () => {
    expect(getContractPinColor({ ...base, status: 'penalized' })).toBe('red')
  })

  it('returns yellow when deadline < 7 days', () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(getContractPinColor({ ...base, deadline: soon })).toBe('yellow')
  })

  it('returns green when deadline > 7 days', () => {
    expect(getContractPinColor(base)).toBe('green')
  })
})

describe('formatAmount', () => {
  it('formats numbers with locale separators', () => {
    const result = formatAmount(1234567)
    expect(result).toMatch(/1.*234.*567/)
  })
})

describe('getMilestoneCompletedCount', () => {
  it('counts accepted milestones', () => {
    const contract: Contract = {
      id: '1', title: 'X', contractor: 'Y', amount_usdc: 100, district: 'A',
      deadline: '', status: 'active', lat: 0, lng: 0, escrow_amount: 0, penalty_amount: 0,
      milestones: [
        { id: '1', desc: 'A', deadline_days: 1, tranche_pct: 50, status: 'accepted' },
        { id: '2', desc: 'B', deadline_days: 2, tranche_pct: 50, status: 'pending' },
        { id: '3', desc: 'C', deadline_days: 3, tranche_pct: 0, status: 'accepted' },
      ],
    }
    expect(getMilestoneCompletedCount(contract)).toBe(2)
  })
})
