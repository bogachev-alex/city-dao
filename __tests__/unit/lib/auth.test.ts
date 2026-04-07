import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AuthUser } from '@/lib/auth'

// ── localStorage mock (node environment has no browser globals) ──────────────
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k in store) delete store[k] }),
}
vi.stubGlobal('localStorage', localStorageMock)
vi.stubGlobal('window', { localStorage: localStorageMock })

// Import after stubbing globals
const { saveAuth, loadAuth, clearAuth, encodeAuthToken, walletToAuthUser } = await import('@/lib/auth')

const DEMO_USER: AuthUser = {
  role: 'CITIZEN',
  id: 'test-citizen-1',
  name: 'Тест Пользователь',
}

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
  // re-seed the clear fn since clearAllMocks resets it
  localStorageMock.clear.mockImplementation(() => {
    for (const k in store) delete store[k]
  })
  localStorageMock.getItem.mockImplementation((key: string) => store[key] ?? null)
  localStorageMock.setItem.mockImplementation((key: string, value: string) => { store[key] = value })
  localStorageMock.removeItem.mockImplementation((key: string) => { delete store[key] })
})

// ─── saveAuth / loadAuth ──────────────────────────────────────────────────────

describe('saveAuth + loadAuth', () => {
  it('round-trips a user through localStorage', () => {
    saveAuth(DEMO_USER)
    const loaded = loadAuth()
    expect(loaded).toEqual(DEMO_USER)
  })

  it('loadAuth returns null when nothing is stored', () => {
    expect(loadAuth()).toBeNull()
  })

  it('loadAuth returns null for malformed JSON', () => {
    store['straita_auth'] = '{not valid json'
    expect(loadAuth()).toBeNull()
  })

  it('overwrites previous user on second save', () => {
    const user2: AuthUser = { role: 'AKIMAT', id: 'akimat-1', name: 'Акиматчик' }
    saveAuth(DEMO_USER)
    saveAuth(user2)
    expect(loadAuth()).toEqual(user2)
  })

  it('preserves all three roles correctly', () => {
    for (const role of ['CITIZEN', 'CONTRACTOR', 'AKIMAT'] as const) {
      const u: AuthUser = { role, id: `${role}-id`, name: role }
      saveAuth(u)
      expect(loadAuth()?.role).toBe(role)
    }
  })
})

// ─── clearAuth ────────────────────────────────────────────────────────────────

describe('clearAuth', () => {
  it('removes stored user', () => {
    saveAuth(DEMO_USER)
    clearAuth()
    expect(loadAuth()).toBeNull()
  })

  it('is safe to call when nothing is stored', () => {
    expect(() => clearAuth()).not.toThrow()
  })
})

// ─── encodeAuthToken ──────────────────────────────────────────────────────────

describe('encodeAuthToken', () => {
  it('returns a non-empty string', () => {
    const token = encodeAuthToken(DEMO_USER)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('token decodes to correct role and id', () => {
    const token = encodeAuthToken(DEMO_USER)
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    expect(decoded.role).toBe(DEMO_USER.role)
    expect(decoded.id).toBe(DEMO_USER.id)
  })

  it('does NOT include the user name in the token', () => {
    const token = encodeAuthToken(DEMO_USER)
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    expect(decoded.name).toBeUndefined()
  })

  it('different roles produce different tokens', () => {
    const citizen = encodeAuthToken({ role: 'CITIZEN', id: 'x', name: 'X' })
    const akimat   = encodeAuthToken({ role: 'AKIMAT',  id: 'x', name: 'X' })
    expect(citizen).not.toBe(akimat)
  })

  it('is compatible with auth-server Bearer extraction', () => {
    // auth-server reads: Buffer.from(token, 'base64').toString('utf8')
    const token = encodeAuthToken({ role: 'AKIMAT', id: 'id1', name: 'N' })
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    expect(payload.role).toBe('AKIMAT')
  })
})

// ─── walletToAuthUser ─────────────────────────────────────────────────────────

describe('walletToAuthUser', () => {
  const WALLET = 'GRxpKMjVx7UiRp4VnDHDdFR6qkuMN5cGSLSYHDQGRg8K'

  it('creates a CITIZEN user', () => {
    const u = walletToAuthUser(WALLET)
    expect(u.role).toBe('CITIZEN')
  })

  it('uses wallet address as id', () => {
    const u = walletToAuthUser(WALLET)
    expect(u.id).toBe(WALLET)
  })

  it('name is a truncated version of the wallet address', () => {
    const u = walletToAuthUser(WALLET)
    expect(u.name).toContain('...')
    expect(u.name.startsWith(WALLET.slice(0, 4))).toBe(true)
    expect(u.name.endsWith(WALLET.slice(-4))).toBe(true)
  })

  it('two different wallets produce different ids', () => {
    const W2 = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
    expect(walletToAuthUser(WALLET).id).not.toBe(walletToAuthUser(W2).id)
  })

  it('produced user can be encoded as auth token', () => {
    const u = walletToAuthUser(WALLET)
    const token = encodeAuthToken(u)
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    expect(decoded.role).toBe('CITIZEN')
    expect(decoded.id).toBe(WALLET)
  })
})
