/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { DEMO_AUTH_USER, type AuthUser } from '@/lib/auth'

// ── mock localStorage via jsdom ───────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear()
})

// Import under test
const { AuthProvider, useAuth } = await import('@/components/AuthContext')

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

const CITIZEN: AuthUser = { role: 'CITIZEN', id: 'c1', name: 'Алибек' }
const AKIMAT:  AuthUser = { role: 'AKIMAT',  id: 'a1', name: 'Акимат' }

// ─── initial state ────────────────────────────────────────────────────────────

describe('AuthContext initial state', () => {
  it('user is null when localStorage is empty', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    // wait for the useEffect to fire
    await act(async () => {})
    expect(result.current.user).toBeNull()
  })

  it('loading becomes false after mount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    expect(result.current.loading).toBe(false)
  })

  it('restores user from localStorage on mount', async () => {
    localStorage.setItem('straita_auth', JSON.stringify(CITIZEN))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    expect(result.current.user).toEqual(CITIZEN)
  })
})

// ─── login / logout ───────────────────────────────────────────────────────────

describe('login', () => {
  it('sets user in context', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.login(CITIZEN))
    expect(result.current.user).toEqual(CITIZEN)
  })

  it('persists user to localStorage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.login(CITIZEN))
    const stored = JSON.parse(localStorage.getItem('straita_auth') ?? 'null')
    expect(stored).toEqual(CITIZEN)
  })
})

describe('logout', () => {
  it('clears user from context', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.login(CITIZEN))
    act(() => result.current.logout())
    expect(result.current.user).toBeNull()
  })

  it('clears localStorage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.login(CITIZEN))
    act(() => result.current.logout())
    expect(localStorage.getItem('straita_auth')).toBeNull()
  })
})

// ─── switchRole ───────────────────────────────────────────────────────────────

describe('switchRole', () => {
  it('updates role in context', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.login(CITIZEN))
    act(() => result.current.switchRole('AKIMAT'))
    expect(result.current.user?.role).toBe('AKIMAT')
  })

  it('preserves id and name for non-demo (e.g. wallet) users', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.login(CITIZEN))
    act(() => result.current.switchRole('CONTRACTOR'))
    expect(result.current.user?.id).toBe(CITIZEN.id)
    expect(result.current.user?.name).toBe(CITIZEN.name)
  })

  it('replaces id and name for demo sessions when switching role', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.login(DEMO_AUTH_USER.CITIZEN))
    act(() => result.current.switchRole('CONTRACTOR'))
    expect(result.current.user).toEqual(DEMO_AUTH_USER.CONTRACTOR)
  })

  it('is a no-op when not logged in', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.switchRole('AKIMAT'))
    expect(result.current.user).toBeNull()
  })
})

// ─── authHeader ───────────────────────────────────────────────────────────────

describe('authHeader', () => {
  it('returns empty object when not logged in', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    expect(result.current.authHeader()).toEqual({})
  })

  it('includes x-user-role and Authorization when logged in', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.login(AKIMAT))
    const headers = result.current.authHeader()
    expect(headers['x-user-role']).toBe('AKIMAT')
    expect(headers['Authorization']).toMatch(/^Bearer /)
  })

  it('Bearer token decodes to correct role and id', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    act(() => result.current.login(AKIMAT))
    const { Authorization } = result.current.authHeader()
    const token = Authorization.replace('Bearer ', '')
    const decoded = JSON.parse(atob(token))
    expect(decoded.role).toBe('AKIMAT')
    expect(decoded.id).toBe(AKIMAT.id)
  })
})

// ─── useAuth outside provider ─────────────────────────────────────────────────

function ConsumerWithoutProvider() {
  useAuth()
  return null
}

describe('useAuth guard', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ConsumerWithoutProvider />)).toThrow('useAuth must be used inside <AuthProvider>')
    spy.mockRestore()
  })
})
