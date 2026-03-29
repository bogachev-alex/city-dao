import { describe, it, expect } from 'vitest'
import { hashIIN, generateSalt, hashVoteCommitment } from '@/lib/crypto'

describe('hashIIN', () => {
  it('returns 64-char hex', async () => {
    const hash = await hashIIN('123456789012')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })
  it('is deterministic', async () => {
    expect(await hashIIN('111111111111')).toBe(await hashIIN('111111111111'))
  })
  it('different IINs → different hashes', async () => {
    expect(await hashIIN('111111111111')).not.toBe(await hashIIN('222222222222'))
  })
})

describe('generateSalt', () => {
  it('returns 64-char hex', () => {
    expect(generateSalt()).toMatch(/^[0-9a-f]{64}$/)
  })
  it('unique each time', () => {
    expect(generateSalt()).not.toBe(generateSalt())
  })
})

describe('hashVoteCommitment', () => {
  it('returns 64-char hex', async () => {
    expect(await hashVoteCommitment('accept', 'salt')).toMatch(/^[0-9a-f]{64}$/)
  })
  it('deterministic', async () => {
    expect(await hashVoteCommitment('accept', 'salt1')).toBe(await hashVoteCommitment('accept', 'salt1'))
  })
  it('different votes → different hashes', async () => {
    const s = 'same'
    expect(await hashVoteCommitment('accept', s)).not.toBe(await hashVoteCommitment('reject', s))
  })
  it('uses vote:salt format matching backend verification', async () => {
    // Backend verifies: createHash('sha256').update(`${vote}:${salt}`).digest('hex')
    // Frontend must produce the same hash for the same vote:salt
    const { createHash } = await import('crypto')
    const vote = 'accept'
    const salt = 'testsalt123'
    const backendHash = createHash('sha256').update(`${vote}:${salt}`).digest('hex')
    const frontendHash = await hashVoteCommitment(vote, salt)
    expect(frontendHash).toBe(backendHash)
  })
})
