export type UserRole = 'CITIZEN' | 'CONTRACTOR' | 'AKIMAT'

export interface AuthUser {
  role: UserRole
  id: string
  name: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  CITIZEN: 'Гражданин',
  CONTRACTOR: 'Подрядчик',
  AKIMAT: 'Представитель акимата',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  CITIZEN: 'Голосуйте в жюри, следите за контрактами, участвуйте в краудфандинге',
  CONTRACTOR: 'Кабинет подрядчика: ваши контракты, этапы, дневники работ и репутация',
  AKIMAT: 'Кабинет акимата: реестр, казны районов, регистрация контрактов',
}

export const ROLE_ICONS: Record<UserRole, string> = {
  CITIZEN: '👤',
  CONTRACTOR: '🏗️',
  AKIMAT: '🏛️',
}

export type NavItem = { href: string; labelKey: string }

/** Canonical demo accounts (same as login page). Used when switching roles in demo sessions. */
export const DEMO_AUTH_USER: Record<UserRole, AuthUser> = {
  CITIZEN: { role: 'CITIZEN', id: 'demo-citizen-1', name: 'Алибек Джаксыбеков' },
  CONTRACTOR: { role: 'CONTRACTOR', id: 'demo-contractor-1', name: 'ТОО СтройАлматы' },
  AKIMAT: { role: 'AKIMAT', id: 'demo-akimat-1', name: 'Сотрудник акимата' },
}

/** True for built-in demo logins (id stable across role switches). */
export function isDemoSessionUser(user: AuthUser | null): boolean {
  if (!user) return false
  return user.id.startsWith('demo-')
}

/**
 * When switching role from the navbar: demo users get the full profile for that role
 * (id + name) so APIs like /api/contractors?id=… match. Wallet users only get role updated.
 */
export function authUserAfterRoleSwitch(current: AuthUser, role: UserRole): AuthUser {
  if (isDemoSessionUser(current)) {
    return { ...DEMO_AUTH_USER[role] }
  }
  return { ...current, role }
}

export const HOME_PATH_BY_ROLE: Record<UserRole, string> = {
  CITIZEN: '/',
  CONTRACTOR: '/contractor',
  AKIMAT: '/akimat',
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  CITIZEN: [
    { href: '/', labelKey: 'map' },
    { href: '/contracts', labelKey: 'contracts' },
    { href: '/crowdfunding', labelKey: 'crowdfunding' },
    { href: '/treasury/Ауэзовский', labelKey: 'treasury' },
    { href: '/profile', labelKey: 'profile' },
  ],
  CONTRACTOR: [
    { href: '/contractor', labelKey: 'contractorDesk' },
    { href: '/contracts', labelKey: 'contracts' },
    { href: '/', labelKey: 'map' },
  ],
  AKIMAT: [
    { href: '/akimat', labelKey: 'akimatDesk' },
    { href: '/contracts', labelKey: 'contracts' },
    { href: '/crowdfunding', labelKey: 'crowdfunding' },
    { href: '/treasury/Ауэзовский', labelKey: 'treasury' },
    { href: '/admin', labelKey: 'admin' },
  ],
}

const AUTH_KEY = 'straita_auth'

export function saveAuth(user: AuthUser): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
}

export function loadAuth(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_KEY)
}

/** Encode auth user as a base64 token for API requests */
export function encodeAuthToken(user: AuthUser): string {
  return btoa(JSON.stringify({ role: user.role, id: user.id }))
}

/**
 * Create an AuthUser from a Solana wallet public key (base58).
 * Wallet-based login defaults to CITIZEN role.
 */
export function walletToAuthUser(publicKeyBase58: string): AuthUser {
  return {
    role: 'CITIZEN',
    id: publicKeyBase58,
    name: `${publicKeyBase58.slice(0, 4)}...${publicKeyBase58.slice(-4)}`,
  }
}
