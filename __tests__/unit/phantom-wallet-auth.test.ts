/**
 * Tests for Phantom wallet authentication flow.
 *
 * The wallet login works without any Solana transactions:
 *   1. User connects Phantom (wallet-adapter, devnet, no SOL needed)
 *   2. publicKey.toBase58() → walletToAuthUser() → login()
 *   3. The resulting AuthUser works with all auth-gated API endpoints
 */
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { walletToAuthUser, encodeAuthToken } from '@/lib/auth'
import { getRoleFromRequest, requireRole } from '@/lib/auth-server'

const PHANTOM_WALLET = 'GRxpKMjVx7UiRp4VnDHDdFR6qkuMN5cGSLSYHDQGRg8K'
const PHANTOM_WALLET_2 = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'

// ─── walletToAuthUser ─────────────────────────────────────────────────────────

describe('walletToAuthUser — Phantom wallet → AuthUser', () => {
  it('creates a CITIZEN user (wallet login defaults to citizen)', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    expect(user.role).toBe('CITIZEN')
  })

  it('wallet address becomes the user id (unique identity)', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    expect(user.id).toBe(PHANTOM_WALLET)
  })

  it('display name is truncated wallet address', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    expect(user.name).toBe(`${PHANTOM_WALLET.slice(0, 4)}...${PHANTOM_WALLET.slice(-4)}`)
  })

  it('two wallets produce different AuthUsers', () => {
    const u1 = walletToAuthUser(PHANTOM_WALLET)
    const u2 = walletToAuthUser(PHANTOM_WALLET_2)
    expect(u1.id).not.toBe(u2.id)
    expect(u1.name).not.toBe(u2.name)
  })
})

// ─── wallet auth token → API compatibility ────────────────────────────────────

describe('wallet auth token — API compatibility', () => {
  it('Bearer token from wallet login is readable by getRoleFromRequest', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    const token = encodeAuthToken(user)
    const req = new NextRequest('http://localhost/', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(getRoleFromRequest(req)).toBe('CITIZEN')
  })

  it('x-user-role header still works alongside wallet token', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    const token = encodeAuthToken(user)
    const req = new NextRequest('http://localhost/', {
      headers: {
        'x-user-role': 'CITIZEN',
        authorization: `Bearer ${token}`,
      },
    })
    expect(getRoleFromRequest(req)).toBe('CITIZEN')
  })

  it('wallet-authenticated CITIZEN can access CITIZEN-only routes', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    const token = encodeAuthToken(user)
    const req = new NextRequest('http://localhost/', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(requireRole(req, ['CITIZEN'])).toBeNull()
  })

  it('wallet-authenticated CITIZEN is denied AKIMAT-only routes (403)', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    const token = encodeAuthToken(user)
    const req = new NextRequest('http://localhost/', {
      headers: { authorization: `Bearer ${token}` },
    })
    const denied = requireRole(req, ['AKIMAT'])
    expect(denied?.status).toBe(403)
  })

  it('wallet-authenticated CITIZEN is denied CONTRACTOR-only routes (403)', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    const token = encodeAuthToken(user)
    const req = new NextRequest('http://localhost/', {
      headers: { authorization: `Bearer ${token}` },
    })
    const denied = requireRole(req, ['CONTRACTOR'])
    expect(denied?.status).toBe(403)
  })
})

// ─── devnet: no real transactions required ────────────────────────────────────

describe('devnet / demo mode constraints', () => {
  it('wallet login does not require any transaction or SOL balance', () => {
    // walletToAuthUser only needs the public key string — no connection, no tx
    const user = walletToAuthUser(PHANTOM_WALLET)
    expect(user).toBeTruthy()
    // The user can produce a valid API token without any on-chain call
    const token = encodeAuthToken(user)
    expect(token.length).toBeGreaterThan(0)
  })

  it('auth token does NOT contain any private key material', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    const token = encodeAuthToken(user)
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    // Token only exposes role + id (public key), never a private key
    expect(Object.keys(decoded)).toEqual(expect.arrayContaining(['role', 'id']))
    expect(Object.keys(decoded)).not.toContain('privateKey')
    expect(Object.keys(decoded)).not.toContain('secretKey')
  })

  it('wallet login AuthUser is serialisable to/from JSON (for localStorage)', () => {
    const user = walletToAuthUser(PHANTOM_WALLET)
    const serialised = JSON.stringify(user)
    const restored = JSON.parse(serialised)
    expect(restored).toEqual(user)
  })
})
