'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from '@/i18n/routing'
import { useAuth } from '@/components/AuthContext'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import {
  type UserRole,
  type AuthUser,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
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
  CONTRACTOR: '/',
  AKIMAT:     '/admin',
}

export default function LoginPage() {
  const { user, login } = useAuth()
  const router = useRouter()
  const { publicKey, connected, select, connect, wallets, wallet, connecting } = useWallet()

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [selectedRole, setSelectedRole] = useState<UserRole>('CITIZEN')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)

  // Already logged in → redirect
  useEffect(() => {
    if (user) {
      router.replace(REDIRECT_AFTER_LOGIN[user.role] as any)
    }
  }, [user, router])

  const handleSubmit = () => {
    const displayName = name.trim() || DEMO_ACCOUNTS[selectedRole].name
    setSubmitting(true)
    const authUser: AuthUser = {
      role: selectedRole,
      id: `${selectedRole.toLowerCase()}-${Date.now()}`,
      name: displayName,
    }
    login(authUser)
    // router.replace fires via useEffect above once `user` updates
  }

  const handleDemoLogin = (role: UserRole) => {
    login(DEMO_ACCOUNTS[role])
  }

  const handleWalletConnect = useCallback(() => {
    setWalletError(null)
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
      connect().catch((e) => setWalletError(e?.message ?? 'Ошибка подключения'))
      return
    }
    select(target.adapter.name)
    setTimeout(() => connect().catch((e) => setWalletError(e?.message ?? 'Ошибка подключения')), 100)
  }, [wallets, wallet, select, connect])

  const handleWalletLogin = () => {
    if (!publicKey) return
    login(walletToAuthUser(publicKey.toBase58()))
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-xl text-white tracking-wider">
            AMANAT <span className="text-emerald-400">PROTOCOL</span>
          </div>
          <div className="text-xs text-gray-500">Прозрачный мониторинг Алматы</div>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Tab switcher */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-2xl p-1 mb-6">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          ))}
        </div>

        {/* Phantom wallet login block */}
        <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-5 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-purple-300">Войти через Phantom кошелёк</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
              devnet
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Подключите Phantom кошелёк (Solana devnet). Транзакции не требуются — вход бесплатный.
          </p>

          {walletError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {walletError}
            </p>
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
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3">
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                <span className="font-mono text-xs text-purple-300 truncate">
                  {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-6)}
                </span>
                <span className="ml-auto text-xs text-gray-500">подключён</span>
              </div>
              <button
                onClick={handleWalletLogin}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold text-sm transition-all shadow-lg shadow-purple-500/20"
              >
                Войти как Гражданин
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <p className="text-xs text-gray-500 text-center uppercase tracking-widest">или войти без кошелька</p>

          {/* Role selection */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Кто вы?</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center ${
                    selectedRole === role
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  <span className="text-2xl">{ROLE_ICONS[role]}</span>
                  <span className="text-xs font-semibold leading-tight">{ROLE_LABELS[role]}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">{ROLE_DESCRIPTIONS[selectedRole]}</p>
          </div>

          {/* Name input */}
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">
              {tab === 'login' ? 'Ваше имя или организация' : 'Имя / название организации'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={DEMO_ACCOUNTS[selectedRole].name}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/60 text-sm"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60"
          >
            {tab === 'login' ? `Войти как ${ROLE_LABELS[selectedRole]}` : `Зарегистрироваться`}
          </button>
        </div>

        {/* Demo switcher */}
        <div className="mt-6 bg-gray-900/60 border border-gray-800 border-dashed rounded-2xl p-4">
          <p className="text-xs text-gray-500 text-center mb-3 uppercase tracking-widest">
            Тестовый режим — быстрый вход
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => handleDemoLogin(role)}
                className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl bg-gray-950 border border-gray-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all"
              >
                <span className="text-xl">{ROLE_ICONS[role]}</span>
                <span className="text-xs text-gray-400 font-medium text-center leading-tight">
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
