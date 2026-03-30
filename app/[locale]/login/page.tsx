'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from '@/i18n/routing'
import { Link } from '@/i18n/routing'
import { useAuth } from '@/components/AuthContext'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import {
  type UserRole,
  type AuthUser,
  ROLE_LABELS,
  ROLE_ICONS,
  walletToAuthUser,
} from '@/lib/auth'

const ROLES: UserRole[] = ['CITIZEN', 'CONTRACTOR', 'AKIMAT']

const DEMO_ACCOUNTS: Record<UserRole, AuthUser> = {
  CITIZEN:    { role: 'CITIZEN',    id: 'demo-citizen-1',    name: 'Алибек Джаксыбеков' },
  CONTRACTOR: { role: 'CONTRACTOR', id: 'demo-contractor-1', name: 'ТОО СтройАлматы' },
  AKIMAT:     { role: 'AKIMAT',     id: 'demo-akimat-1',     name: 'Сотрудник акимата' },
}

const REDIRECT_AFTER_LOGIN: Record<UserRole, string> = {
  CITIZEN:    '/',
  CONTRACTOR: '/contractor',
  AKIMAT:     '/akimat',
}

export default function LoginPage() {
  const { user, login } = useAuth()
  const router = useRouter()
  const { publicKey, connected, select, connect, wallets, wallet, connecting } = useWallet()

  const [walletError, setWalletError] = useState<string | null>(null)
  const [pendingConnect, setPendingConnect] = useState(false)
  const [checking, setChecking] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (user) {
      router.replace(REDIRECT_AFTER_LOGIN[user.role] as any)
    }
  }, [user, router])

  useEffect(() => {
    if (pendingConnect && wallet && !connected && !connecting) {
      setPendingConnect(false)
      connect().catch((e) => setWalletError(e?.message ?? 'Ошибка подключения'))
    }
  }, [pendingConnect, wallet, connected, connecting, connect])

  const handleWalletConnect = useCallback(() => {
    setWalletError(null)
    setNotFound(false)
    const isUsable = (state: WalletReadyState) =>
      state === WalletReadyState.Installed || state === WalletReadyState.Loadable
    const phantom = wallets.find((w) => w.adapter.name === 'Phantom' && isUsable(w.readyState))
    const anyUsable = wallets.find((w) => isUsable(w.readyState))
    const target = phantom || anyUsable
    if (!target) {
      window.open('https://phantom.app/', '_blank')
      return
    }
    if (wallet?.adapter.name === target.adapter.name) {
      connect().catch((e) => setWalletError(e?.message ?? 'Ошибка подключения'))
      return
    }
    select(target.adapter.name)
    setPendingConnect(true)
  }, [wallets, wallet, select, connect])

  const handleWalletLogin = async () => {
    if (!publicKey) return
    setChecking(true)
    setNotFound(false)
    try {
      const res = await fetch(`/api/citizens?wallet=${publicKey.toBase58()}`)
      if (res.ok) {
        const data = await res.json()
        // Use stored name from registration if available
        const stored = localStorage.getItem('citizen_profile')
        const name = stored ? JSON.parse(stored).name : undefined
        const authUser = walletToAuthUser(publicKey.toBase58())
        if (name) authUser.name = name
        login(authUser)
      } else {
        setNotFound(true)
      }
    } catch {
      // If API unreachable (no DB), fall through to demo mode
      login(walletToAuthUser(publicKey.toBase58()))
    } finally {
      setChecking(false)
    }
  }

  const handleDemoLogin = (role: UserRole) => {
    login(DEMO_ACCOUNTS[role])
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-xl text-gray-900 dark:text-white tracking-wider">
            AMANAT <span className="text-emerald-600 dark:text-emerald-400">PROTOCOL</span>
          </div>
          <div className="text-xs text-gray-500">Прозрачный мониторинг Алматы</div>
        </div>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Wallet login */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Вход в систему</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Подключите Phantom кошелёк для входа
            </p>
          </div>

          {walletError && (
            <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
              {walletError}
            </p>
          )}

          {notFound && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-semibold mb-1">
                Аккаунт не найден
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400/80 mb-3">
                Этот кошелёк ещё не зарегистрирован в системе Amanat Protocol.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Зарегистрироваться
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}

          {!connected ? (
            <button
              onClick={handleWalletConnect}
              disabled={connecting}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {connecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Подключение...
                </>
              ) : (
                <>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Подключить Phantom
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-xl px-4 py-3">
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                <span className="font-mono text-xs text-purple-700 dark:text-purple-300 truncate">
                  {publicKey?.toBase58().slice(0, 10)}...{publicKey?.toBase58().slice(-8)}
                </span>
                <span className="ml-auto text-xs text-gray-400">подключён</span>
              </div>
              <button
                onClick={handleWalletLogin}
                disabled={checking}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {checking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                    </svg>
                    Войти
                  </>
                )}
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            Ещё нет аккаунта?{' '}
            <Link href="/register" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>

        {/* Demo test access */}
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3 uppercase tracking-widest font-medium">
            Тестовый доступ
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => handleDemoLogin(role)}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-emerald-400/50 dark:hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-all"
              >
                <span className="text-2xl">{ROLE_ICONS[role]}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium text-center leading-tight">
                  {ROLE_LABELS[role]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
