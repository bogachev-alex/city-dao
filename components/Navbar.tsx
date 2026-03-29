'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import { useTheme } from './ThemeProvider'
import { useAuth } from './AuthContext'
import { ROLE_LABELS, ROLE_ICONS, NAV_BY_ROLE, type UserRole } from '@/lib/auth'

const ALL_ROLES: UserRole[] = ['CITIZEN', 'CONTRACTOR', 'AKIMAT']

function WalletButton() {
  const { connected, connecting, publicKey, select, connect, disconnect, wallet, wallets } = useWallet()
  const { connection } = useConnection()
  const [error, setError] = useState<string | null>(null)
  const [wrongNetwork, setWrongNetwork] = useState(false)
  const pendingConnect = useRef(false)

  useEffect(() => {
    if (pendingConnect.current && wallet && !connected && !connecting) {
      pendingConnect.current = false
      connect().catch((e: any) => {
        setError(e?.message || 'Ошибка подключения')
      })
    }
  }, [wallet, connected, connecting, connect])

  useEffect(() => {
    if (!connected) { setWrongNetwork(false); return }
    connection.getGenesisHash().then((hash) => {
      const isDevnet = hash === 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
      setWrongNetwork(!isDevnet)
    }).catch(() => {})
  }, [connected, connection])

  const handleConnect = useCallback(() => {
    setError(null)
    const phantom = wallets.find(
      (w) => w.adapter.name === 'Phantom' && w.readyState === WalletReadyState.Installed
    )
    const anyInstalled = wallets.find((w) => w.readyState === WalletReadyState.Installed)
    const target = phantom || anyInstalled
    if (!target) {
      window.open('https://phantom.app/', '_blank')
      return
    }
    if (wallet && wallet.adapter.name === target.adapter.name) {
      connect().catch((e: any) => {
        setError(e?.message || 'Ошибка подключения')
      })
      return
    }
    pendingConnect.current = true
    select(target.adapter.name)
  }, [wallets, wallet, connect, select])

  const handleDisconnect = useCallback(async () => {
    try { await disconnect() } catch {}
  }, [disconnect])

  if (connected && publicKey) {
    const addr = publicKey.toBase58()
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${wrongNetwork ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${wrongNetwork ? 'bg-red-400' : 'bg-emerald-400'}`} />
            {addr.slice(0, 4)}…{addr.slice(-4)}
          </div>
          <button onClick={handleDisconnect} className="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            ✕
          </button>
        </div>
        {wrongNetwork && (
          <span className="text-xs text-red-400">Переключите Phantom на Devnet</span>
        )}
      </div>
    )
  }

  if (connecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-400">
        <div className="w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />
        Подключение…
      </div>
    )
  }

  const phantomInstalled = wallets.some(
    (w) => w.adapter.name === 'Phantom' && w.readyState === WalletReadyState.Installed
  )

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleConnect}
        className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-xs text-purple-300 hover:bg-purple-500/30 transition-colors font-medium"
      >
        {phantomInstalled ? 'Подключить Phantom' : 'Установить Phantom'}
      </button>
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  )
}

export default function Navbar() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const { user, logout, switchRole } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const navLinks = user
    ? NAV_BY_ROLE[user.role].map((item) => ({ href: item.href, label: t(item.labelKey as any) }))
    : []

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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:shadow-emerald-500/50 transition-shadow">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-wider text-gray-900 dark:text-white">
              AMANAT <span className="text-emerald-600 dark:text-emerald-400">PROTOCOL</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href as any}
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
            {/* Locale switcher */}
            <button
              onClick={switchLocale}
              disabled={isPending}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
            >
              {locale === 'ru' ? 'KK' : 'RU'}
            </button>

            {mounted && (
              <div className="hidden md:block">
                <WalletButton />
              </div>
            )}

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

            {/* User block */}
            {mounted && user ? (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setRoleSwitcherOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                >
                  <span>{ROLE_ICONS[user.role]}</span>
                  <span className="max-w-[100px] truncate">{user.name}</span>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {roleSwitcherOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-800">
                      <p className="text-xs text-gray-500 uppercase tracking-widest">Переключить роль</p>
                    </div>
                    {ALL_ROLES.map((role) => (
                      <button
                        key={role}
                        onClick={() => { switchRole(role); setRoleSwitcherOpen(false) }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                          user.role === role
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        <span>{ROLE_ICONS[role]}</span>
                        <span>{ROLE_LABELS[role]}</span>
                        {user.role === role && (
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="ml-auto">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                    <div className="border-t border-gray-800">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
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
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => { switchRole(role); setMobileOpen(false) }}
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
            {mounted && (
              <div className="mt-2">
                <WalletButton />
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
