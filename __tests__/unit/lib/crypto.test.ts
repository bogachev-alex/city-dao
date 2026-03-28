import { describe, it, expect } from 'vitest'
import { hashIIN, generateSalt, hashVoteCommitment } from '@/lib/crypto'

describe('hashIIN', () => {
  it('returns 64-char hex string', async () => {
    const hash = await hashIIN('123456789012')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('is deterministic', async () => {
    const h1 = await hashIIN('123456789012')
    const h2 = await hashIIN('123456789012')
    expect(h1).toBe(h2)
  })

  it('different inputs produce different hashes', async () => {
    const h1 = await hashIIN('111111111111')
    const h2 = await hashIIN('222222222222')
    expect(h1).not.toBe(h2)
  })
})

describe('generateSalt', () => {
  it('returns 64-char hex string', () => {
    const salt = generateSalt()
    expect(salt).toHaveLength(64)
    expect(salt).toMatch(/^[0-9a-f]+$/)
  })

  it('generates unique salts', () => {
    const s1 = generateSalt()
    const s2 = generateSalt()
    expect(s1).not.toBe(s2)
  })
})

describe('hashVoteCommitment', () => {
  it('returns 64-char hex string', async () => {
    const hash = await hashVoteCommitment('accept', 'somesalt')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('is deterministic', async () => {
    const h1 = await hashVoteCommitment('accept', 'salt123')
    const h2 = await hashVoteCommitment('accept', 'salt123')
    expect(h1).toBe(h2)
  })

  it('different votes produce different hashes', async () => {
    const salt = 'samesalt'
    const h1 = await hashVoteCommitment('accept', salt)
    const h2 = await hashVoteCommitment('reject', salt)
    expect(h1).not.toBe(h2)
  })

  it('different salts produce different hashes', async () => {
    const h1 = await hashVoteCommitment('accept', 'salt1')
    const h2 = await hashVoteCommitment('accept', 'salt2')
    expect(h1).not.toBe(h2)
  })
})
