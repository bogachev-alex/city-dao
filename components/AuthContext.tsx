'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  type AuthUser,
  type UserRole,
  loadAuth,
  saveAuth,
  clearAuth,
  encodeAuthToken,
  authUserAfterRoleSwitch,
} from '@/lib/auth'

interface AuthContextValue {
  user: AuthUser | null
  /** True while reading from localStorage on first mount */
  loading: boolean
  login: (user: AuthUser) => void
  logout: () => void
  /** Convenience: build the Authorization header value for API calls */
  authHeader: () => Record<string, string>
  /** Switch role instantly (for demo/test switcher) */
  switchRole: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(loadAuth())
    setLoading(false)
  }, [])

  const login = useCallback((u: AuthUser) => {
    saveAuth(u)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setUser(null)
  }, [])

  const switchRole = useCallback(
    (role: UserRole) => {
      if (!user) return
      const updated = authUserAfterRoleSwitch(user, role)
      saveAuth(updated)
      setUser(updated)
    },
    [user]
  )

  const authHeader = useCallback((): Record<string, string> => {
    if (!user) return {}
    return {
      'x-user-role': user.role,
      Authorization: `Bearer ${encodeAuthToken(user)}`,
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authHeader, switchRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
