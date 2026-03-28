import { describe, it, expect } from 'vitest'
import {
  getCitizenTarget,
  getStateMatch,
  getCampaignProgress,
  getDonorTier,
  getDaysLeft,
  formatTenge,
  normalizeCampaign,
  Campaign,
} from '@/lib/crowdfunding'

describe('getCitizenTarget', () => {
  it('playground: citizens pay 10%', () => {
    expect(getCitizenTarget(10_000_000, 'playground')).toBe(1_000_000)
  })
  it('school: citizens pay 10%', () => {
    expect(getCitizenTarget(10_000_000, 'school')).toBe(1_000_000)
  })
  it('roads: citizens pay 30%', () => {
    expect(getCitizenTarget(10_000_000, 'roads')).toBe(3_000_000)
  })
  it('landscaping: citizens pay 50%', () => {
    expect(getCitizenTarget(10_000_000, 'landscaping')).toBe(5_000_000)
  })
  it('commercial: citizens pay 100%', () => {
    expect(getCitizenTarget(10_000_000, 'commercial')).toBe(10_000_000)
  })
})

describe('getStateMatch', () => {
  it('playground: state pays 90%', () => {
    expect(getStateMatch(10_000_000, 'playground')).toBe(9_000_000)
  })
  it('commercial: state pays 0%', () => {
    expect(getStateMatch(10_000_000, 'commercial')).toBe(0)
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

  it('returns 0 when nothing raised', () => {
    expect(getCampaignProgress(base)).toBe(0)
  })

  it('returns 50 when half raised', () => {
    expect(getCampaignProgress({ ...base, citizen_raised: 500_000 })).toBe(50)
  })

  it('returns 100 when fully raised', () => {
    expect(getCampaignProgress({ ...base, citizen_raised: 1_000_000 })).toBe(100)
  })
})

describe('getDonorTier', () => {
  it('< 5000 → participant', () => {
    expect(getDonorTier(1000)).toBe('participant')
    expect(getDonorTier(4999)).toBe('participant')
  })
  it('5000-49999 → patron', () => {
    expect(getDonorTier(5000)).toBe('patron')
    expect(getDonorTier(49999)).toBe('patron')
  })
  it('>= 50000 → founder', () => {
    expect(getDonorTier(50000)).toBe('founder')
    expect(getDonorTier(100000)).toBe('founder')
  })
})

describe('getDaysLeft', () => {
  it('returns positive for future', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(getDaysLeft(future)).toBe(10)
  })
  it('returns negative for past', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(getDaysLeft(past)).toBe(-3)
  })
})

describe('formatTenge', () => {
  it('formats with ₸ symbol', () => {
    const result = formatTenge(1500000)
    expect(result).toContain('₸')
  })
})

describe('normalizeCampaign', () => {
  it('maps Prisma format to frontend Campaign', () => {
    const prismaData = {
      id: 'cf-1',
      title: 'Test Campaign',
      description: 'Desc',
      district: 'Ауэзовский',
      category: 'PLAYGROUND',
      status: 'ACTIVE',
      targetAmount: '10000000',
      citizenTarget: '1000000',
      stateMatch: '9000000',
      citizenRaised: '500000',
      stateDeposited: false,
      donorCount: 5,
      deadline: '2026-06-01',
      createdAt: '2026-03-01',
      creator: { walletAddress: 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890ABCD', tier: 'GUARDIAN' },
      lat: 43.24,
      lng: 76.87,
      contributions: [],
    }

    const result = normalizeCampaign(prismaData)
    expect(result.id).toBe('cf-1')
    expect(result.category).toBe('playground')
    expect(result.status).toBe('active')
    expect(result.target_amount).toBe(10000000)
    expect(result.citizen_target).toBe(1000000)
    expect(result.citizen_raised).toBe(500000)
    expect(result.creator_wallet).toBe('AbCdEfGhIjKlMnOpQrStUvWxYz1234567890ABCD')
    expect(result.creator_tier).toBe('Gold') // GUARDIAN maps to 'Gold' in TIER_MAP
  })
})
