'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { useState, useEffect, useTransition } from 'react'
import { useTheme } from './ThemeProvider'
import { useAuth } from './AuthContext'
import { useA11y } from './AccessibilityProvider'
import { ROLE_LABELS, ROLE_ICONS, NAV_BY_ROLE, HOME_PATH_BY_ROLE, type UserRole, isDemoSessionUser } from '@/lib/auth'
import { getWallet, formatBalance } from '@/lib/tokens'
import { useWallet } from '@solana/wallet-adapter-react'

const ALL_ROLES: UserRole[] = ['CITIZEN', 'CONTRACTOR', 'AKIMAT']

export default function Navbar() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const { user, logout, switchRole } = useAuth()
  const { enabled: a11y, toggle: toggleA11y } = useA11y()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false)
  const [tokenBalance, setTokenBalance] = useState(0)
  const { connected: walletAdapterConnected, publicKey: walletPublicKey } = useWallet()
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>(ALL_ROLES)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!user) { setAvailableRoles(ALL_ROLES); return }
    if (isDemoSessionUser(user)) { setAvailableRoles(ALL_ROLES); return }

    let cancelled = false
    async function load() {
      if (!user) return
      try {
        const roles: UserRole[] = [user.role]
        const res = await fetch(`/api/roles?wallet=${encodeURIComponent(user.id)}`)
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          if (data.roles?.length) {
            const dbRoles = data.roles as UserRole[]
            for (const r of dbRoles) {
              if (!roles.includes(r)) roles.push(r)
            }
          }
        }
        const akRaw = localStorage.getItem('akimat_profile')
        if (akRaw) {
          try {
            const ak = JSON.parse(akRaw)
            if (ak.walletAddress === user.id && !roles.includes('AKIMAT')) roles.push('AKIMAT')
          } catch {}
        }
        if (!cancelled) setAvailableRoles(roles)
      } catch {
        if (!cancelled) setAvailableRoles([user.role])
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    setTokenBalance(getWallet().balance)
    function refresh() { setTokenBalance(getWallet().balance) }
    window.addEventListener('amanat-token-award', refresh)
    return () => window.removeEventListener('amanat-token-award', refresh)
  }, [])

  const DEFAULT_NAV: { href: string; labelKey: string }[] = [
    { href: '/', labelKey: 'map' },
    { href: '/contracts', labelKey: 'contracts' },
    { href: '/crowdfunding', labelKey: 'crowdfunding' },
    { href: '/treasury/Ауэзовский', labelKey: 'treasury' },
    { href: '/blockchain', labelKey: 'blockchain' },
  ]

  const navItems = user ? NAV_BY_ROLE[user.role] : DEFAULT_NAV
  const navLinks = navItems.map((item) => ({ href: item.href, label: t(item.labelKey as any), tour: item.labelKey }))

  const switchLocale = () => {
    const nextLocale = locale === 'ru' ? 'kk' : 'ru'
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale })
    })
  }

  const handleLogout = () => {
    logout()
    router.replace('/login' as any)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group" data-tour="logo">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:shadow-emerald-500/50 transition-shadow">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-wider text-gray-900 dark:text-white">
              AMANAT <span className="text-emerald-600 dark:text-emerald-400">PROTOCOL</span>
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40">
              DEVNET MODE
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href as any}
                data-tour={link.tour}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* ADL token balance */}
            {mounted && tokenBalance > 0 && (
              <Link
                href="/profile"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all"
              >
                <span className="text-emerald-400 font-bold text-[10px]">ADL</span>
                <span className="text-emerald-400 font-semibold text-xs">{formatBalance(tokenBalance)}</span>
              </Link>
            )}

            {/* Locale switcher */}
            <button
              onClick={switchLocale}
              disabled={isPending}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
            >
              {locale === 'ru' ? 'KK' : 'RU'}
            </button>

            {/* Accessibility toggle */}
            {mounted && (
              <button
                onClick={toggleA11y}
                className={`p-2 rounded-md transition-colors ${
                  a11y
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title={a11y ? 'Обычная версия' : 'Версия для слабовидящих'}
                aria-label={a11y ? 'Выключить режим для слабовидящих' : 'Включить режим для слабовидящих'}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            )}

            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={toggle}
                className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              >
                {theme === 'dark' ? (
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            )}

            {/* User block — combined wallet status + role switcher */}
            {mounted && user ? (
              <div className="relative hidden md:flex items-center" data-tour="auth">
                <button
                  onClick={() => setRoleSwitcherOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${walletAdapterConnected ? 'bg-purple-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-600'}`}
                    title={walletAdapterConnected ? `Phantom: ${walletPublicKey?.toBase58().slice(0, 6)}...${walletPublicKey?.toBase58().slice(-4)}` : 'Phantom не подключён'}
                  />
                  <span>{ROLE_ICONS[user.role]}</span>
                  <span className="max-w-[80px] truncate">{user.name}</span>
                  {availableRoles.length > 1 && (
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                {roleSwitcherOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Phantom status */}
                    <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
                      {walletAdapterConnected && walletPublicKey ? (
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
                          <span className="text-xs text-purple-600 dark:text-purple-400 font-mono">
                            {walletPublicKey.toBase58().slice(0, 6)}...{walletPublicKey.toBase58().slice(-4)}
                          </span>
                        </div>
                      ) : (
                        <Link
                          href="/login"
                          onClick={() => setRoleSwitcherOpen(false)}
                          className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600 shrink-0" />
                          Подключить Phantom
                        </Link>
                      )}
                    </div>
                    {/* Role switcher */}
                    <div className="px-3 pt-2 pb-1">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">Роль</p>
                    </div>
                    {availableRoles.map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          switchRole(role)
                          setRoleSwitcherOpen(false)
                          router.push(HOME_PATH_BY_ROLE[role] as any)
                        }}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                          user.role === role
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <span>{ROLE_ICONS[role]}</span>
                        <span>{ROLE_LABELS[role]}</span>
                        {user.role === role && (
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="ml-auto shrink-0">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-800">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Выйти
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : mounted && (
              <Link
                href="/login"
                data-tour="auth"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
              >
                Войти
              </Link>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href as any}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === link.href
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {mounted && user ? (
              <>
                <div className="pt-2 pb-1 px-3 text-xs text-gray-500 uppercase tracking-widest">
                  Переключить роль
                </div>
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      switchRole(role)
                      setMobileOpen(false)
                      router.push(HOME_PATH_BY_ROLE[role] as any)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                      user.role === role
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span>{ROLE_ICONS[role]}</span>
                    <span>{ROLE_LABELS[role]}</span>
                  </button>
                ))}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-red-500 dark:text-red-400"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-emerald-600 dark:text-emerald-400"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
