import { describe, it, expect } from 'vitest'
import {
  getCitizenTarget, getStateMatch, getCampaignProgress,
  getDonorTier, formatTenge, normalizeCampaign, Campaign,
  getDeadlineComponents, formatCrowdfundingCountdown,
} from '@/lib/crowdfunding'

describe('getCitizenTarget / getStateMatch', () => {
  // Citizens pay: playground 10%, school 10%, roads 30%, landscaping 50%, commercial 100%
  it.each([
    ['playground', 1_000_000, 9_000_000],
    ['school',     1_000_000, 9_000_000],
    ['roads',      3_000_000, 7_000_000],
    ['landscaping',5_000_000, 5_000_000],
    ['commercial', 10_000_000, 0],
  ] as const)('%s: citizen=%d, state=%d', (cat, citizenExpected, stateExpected) => {
    expect(getCitizenTarget(10_000_000, cat)).toBe(citizenExpected)
    expect(getStateMatch(10_000_000, cat)).toBe(stateExpected)
  })
})

describe('getCampaignProgress', () => {
  const base: Campaign = {
    id: '1', title: 'X', description: '', district: 'A', category: 'playground',
    status: 'active', target_amount: 10_000_000, citizen_target: 1_000_000,
    state_match: 9_000_000, citizen_raised: 0, state_deposited: false,
    donor_count: 0, deadline: '', created_at: '', creator: '', creator_wallet: '',
    creator_tier: '', lat: 0, lng: 0, donors: [],
  }

  it('0% when nothing raised', () => expect(getCampaignProgress(base)).toBe(0))
  it('50% when half raised', () => expect(getCampaignProgress({ ...base, citizen_raised: 500_000 })).toBe(50))
  it('100% when fully raised', () => expect(getCampaignProgress({ ...base, citizen_raised: 1_000_000 })).toBe(100))
})

describe('formatTenge', () => {
  it('shows tenge with SOL and USDT equivalents', () => {
    const result = formatTenge(8_000_000) // 8M tenge = 100 SOL = ~15686 USDT
    expect(result).toContain('₸')
    expect(result).toContain('SOL')
    expect(result).toContain('USDT')
  })
})

describe('getDonorTier', () => {
  it('< 5000 → participant', () => expect(getDonorTier(4999)).toBe('participant'))
  it('5000 → patron', () => expect(getDonorTier(5000)).toBe('patron'))
  it('50000 → founder', () => expect(getDonorTier(50000)).toBe('founder'))
})

describe('getDeadlineComponents', () => {
  const now = new Date('2026-01-10T12:00:00.000Z').getTime()

  it('splits 5d 3h 12m remaining', () => {
    const deadline = new Date('2026-01-15T15:12:00.000Z').toISOString()
    expect(getDeadlineComponents(deadline, now)).toEqual({
      isPast: false,
      days: 5,
      hours: 3,
      minutes: 12,
    })
  })

  it('splits 45 minutes remaining', () => {
    const deadline = new Date(now + 45 * 60_000).toISOString()
    expect(getDeadlineComponents(deadline, now)).toEqual({
      isPast: false,
      days: 0,
      hours: 0,
      minutes: 45,
    })
  })

  it('elapsed after deadline', () => {
    const deadline = new Date('2026-01-08T12:00:00.000Z').toISOString()
    expect(getDeadlineComponents(deadline, now)).toEqual({
      isPast: true,
      days: 2,
      hours: 0,
      minutes: 0,
    })
  })

  it('treats exact moment as past', () => {
    const deadline = new Date(now).toISOString()
    expect(getDeadlineComponents(deadline, now).isPast).toBe(true)
  })
})

describe('formatCrowdfundingCountdown', () => {
  const now = new Date('2026-01-10T12:00:00.000Z').getTime()

  it('formats future multi-day with hours and minutes', () => {
    const deadline = new Date('2026-01-15T15:12:00.000Z').toISOString()
    expect(formatCrowdfundingCountdown(deadline, now)).toBe('5 дн. 3 ч. 12 мин')
  })

  it('formats hours and minutes without days', () => {
    const deadline = new Date(now + (2 * 3600_000 + 5 * 60_000)).toISOString()
    expect(formatCrowdfundingCountdown(deadline, now)).toBe('2 ч. 5 мин')
  })

  it('formats minutes only', () => {
    const deadline = new Date(now + 45 * 60_000).toISOString()
    expect(formatCrowdfundingCountdown(deadline, now)).toBe('45 мин')
  })

  it('formats under one minute', () => {
    const deadline = new Date(now + 30_000).toISOString()
    expect(formatCrowdfundingCountdown(deadline, now)).toBe('меньше минуты')
  })

  it('formats past as days ago', () => {
    const deadline = new Date('2026-01-08T12:00:00.000Z').toISOString()
    expect(formatCrowdfundingCountdown(deadline, now)).toBe('2 дн. назад')
  })

  it('formats just expired as только что', () => {
    const deadline = new Date(now).toISOString()
    expect(formatCrowdfundingCountdown(deadline, now)).toBe('только что')
  })
})

describe('normalizeCampaign TIER_MAP', () => {
  // BUG FIX: GUARDIAN was mapping to 'Gold' same as TRUSTED. Now maps to 'Platinum'
  it('GUARDIAN maps to Platinum (not Gold)', () => {
    const result = normalizeCampaign({
      id: '1', title: 'X', description: '', district: 'A',
      category: 'PLAYGROUND', status: 'ACTIVE', targetAmount: '100',
      citizenTarget: '10', stateMatch: '90', citizenRaised: '0',
      deadline: '2026-01-01', createdAt: '2026-01-01',
      creator: { walletAddress: 'SomeWallet123', tier: 'GUARDIAN' },
      lat: 0, lng: 0, contributions: [],
    })
    expect(result.creator_tier).toBe('Platinum')
  })

  it('TRUSTED maps to Gold', () => {
    const result = normalizeCampaign({
      id: '1', title: 'X', description: '', district: 'A',
      category: 'PLAYGROUND', status: 'ACTIVE', targetAmount: '100',
      citizenTarget: '10', stateMatch: '90', citizenRaised: '0',
      deadline: '2026-01-01', createdAt: '2026-01-01',
      creator: { walletAddress: 'SomeWallet123', tier: 'TRUSTED' },
      lat: 0, lng: 0, contributions: [],
    })
    expect(result.creator_tier).toBe('Gold')
  })

  it('TRUSTED and GUARDIAN map to DIFFERENT tiers', () => {
    const trusted = normalizeCampaign({
      id: '1', title: 'X', description: '', district: 'A',
      category: 'ACTIVE', status: 'ACTIVE', targetAmount: '1',
      citizenTarget: '1', stateMatch: '0', citizenRaised: '0',
      deadline: '2026-01-01', createdAt: '2026-01-01',
      creator: { walletAddress: 'W', tier: 'TRUSTED' },
      lat: 0, lng: 0, contributions: [],
    })
    const guardian = normalizeCampaign({
      id: '2', title: 'Y', description: '', district: 'A',
      category: 'ACTIVE', status: 'ACTIVE', targetAmount: '1',
      citizenTarget: '1', stateMatch: '0', citizenRaised: '0',
      deadline: '2026-01-01', createdAt: '2026-01-01',
      creator: { walletAddress: 'W', tier: 'GUARDIAN' },
      lat: 0, lng: 0, contributions: [],
    })
    expect(trusted.creator_tier).not.toBe(guardian.creator_tier)
  })
})
