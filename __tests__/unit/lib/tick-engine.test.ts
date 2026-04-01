import { describe, expect, it } from 'vitest'
import { addDaysUtc, gameDayDateUtc } from '@/lib/tick-engine'

describe('gameDayDateUtc', () => {
  it('shifts UTC calendar by gameDay from start', () => {
    const start = new Date('2025-01-01T12:00:00.000Z')
    const d0 = gameDayDateUtc(start, 0)
    expect(d0.toISOString().startsWith('2025-01-01')).toBe(true)
    const d3 = gameDayDateUtc(start, 3)
    expect(d3.toISOString().startsWith('2025-01-04')).toBe(true)
  })
})

describe('addDaysUtc', () => {
  it('adds whole days in UTC', () => {
    const base = new Date('2025-06-10T00:00:00.000Z')
    const out = addDaysUtc(base, 7)
    expect(out.toISOString()).toBe('2025-06-17T00:00:00.000Z')
  })
})
