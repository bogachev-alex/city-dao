'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/components/AuthContext'
import { fetchCitizen, registerCitizen } from '@/lib/api'
import { Link, useRouter } from '@/i18n/routing'
import { getWallet, formatBalance, type TokenWallet } from '@/lib/tokens'

interface CitizenProfile {
  walletAddress: string
  district: string
  reputationScore: number
  tier: string
  votesCast: number
  votesWithMajority: number
  missedJuryCount: number
  juryVotes?: { id: string; session: any }[]
}

const DEMO_PROFILE: CitizenProfile = {
  walletAddress: 'demo',
  district: 'Ауэзовский',
  reputationScore: 75,
  tier: 'NEW',
  votesCast: 3,
  votesWithMajority: 2,
  missedJuryCount: 0,
}

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; min: number; max: number }> = {
  NEW:      { color: 'text-gray-500 dark:text-gray-400',   bg: 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700',   border: 'border-gray-300 dark:border-gray-600',        min: 0,   max: 50   },
  ACTIVE:   { color: 'text-orange-500 dark:text-orange-400', bg: 'from-orange-50 to-orange-100',                                   border: 'border-orange-200 dark:border-orange-500/30', min: 50,  max: 150  },
  TRUSTED:  { color: 'text-blue-500 dark:text-blue-400',   bg: 'from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800',    border: 'border-blue-200 dark:border-blue-500/30',     min: 150, max: 300  },
  GUARDIAN: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'from-yellow-50 to-yellow-100',                                   border: 'border-yellow-200 dark:border-yellow-500/30', min: 300, max: 1000 },
}

const TIER_LABELS: Record<string, string> = {
  NEW: 'Новичок',
  ACTIVE: 'Активный',
  TRUSTED: 'Доверенный',
  GUARDIAN: 'Хранитель',
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [citizen, setCitizen] = useState<CitizenProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [tokenWallet, setTokenWallet] = useState<TokenWallet>({ balance: 0, transactions: [] })
  const [onChainBalance, setOnChainBalance] = useState<number | null>(null)

  // Load token wallet and listen for awards
  useEffect(() => {
    setTokenWallet(getWallet())
    function refresh() { setTokenWallet(getWallet()) }
    window.addEventListener('amanat-token-award', refresh)
    return () => window.removeEventListener('amanat-token-award', refresh)
  }, [])

  // For real wallet users: fetch on-chain ADL balance
  useEffect(() => {
    if (!user || user.id.startsWith('demo-')) return
    fetch(`/api/tokens/balance?wallet=${user.id}`)
      .then((r) => r.json())
      .then((data) => { if (data.configured && typeof data.balance === 'number') setOnChainBalance(data.balance) })
      .catch(() => {})

    function refreshOnChain() {
      if (!user || user.id.startsWith('demo-')) return
      setTimeout(() => {
        fetch(`/api/tokens/balance?wallet=${user.id}`)
          .then((r) => r.json())
          .then((data) => { if (data.configured && typeof data.balance === 'number') setOnChainBalance(data.balance) })
          .catch(() => {})
      }, 3000) // wait for chain confirmation
    }
    window.addEventListener('amanat-token-award', refreshOnChain)
    return () => window.removeEventListener('amanat-token-award', refreshOnChain)
  }, [user])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.replace('/login' as any)
      return
    }

    if (user.role === 'CONTRACTOR') {
      router.replace('/contractor' as any)
      return
    }

    if (user.role === 'AKIMAT') {
      router.replace('/akimat' as any)
      return
    }

    // Demo users: id looks like 'demo-citizen-1'
    if (user.id.startsWith('demo-')) {
      setIsDemo(true)
      setCitizen(DEMO_PROFILE)
      setLoadingProfile(false)
      return
    }

    // Real wallet user — fetch from API, auto-register if not found
    setIsDemo(false)
    fetchCitizen(user.id)
      .then(async (data) => {
        if (data && !data.error) {
          setCitizen(data)
          return
        }
        // Wallet connected but no citizen record — auto-register with defaults
        const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.id + ':auto-citizen') as unknown as ArrayBuffer)
        const iinHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
        const created = await registerCitizen({ walletAddress: user.id, district: 'Алмалинский', iinHash })
        if (created && !created.error) setCitizen(created)
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false))
  }, [user, authLoading, router])

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!citizen) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Вы ещё не зарегистрированы</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Пройдите регистрацию, чтобы участвовать в голосованиях и контролировать контракты.
          </p>
          <Link href="/register" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors">
            Зарегистрироваться
          </Link>
        </div>
      </div>
    )
  }

  const tierKey = citizen.tier || 'NEW'
  const tier = TIER_CONFIG[tierKey] || TIER_CONFIG.NEW
  const tierLabel = TIER_LABELS[tierKey] || tierKey
  const nextTierKey = tierKey === 'NEW' ? 'ACTIVE' : tierKey === 'ACTIVE' ? 'TRUSTED' : tierKey === 'TRUSTED' ? 'GUARDIAN' : null
  const nextTierLabel = nextTierKey ? TIER_LABELS[nextTierKey] : null
  const progressToNext = nextTierKey && TIER_CONFIG[nextTierKey]
    ? Math.round(((citizen.reputationScore - tier.min) / (tier.max - tier.min)) * 100)
    : 100
  const accuracy = citizen.votesCast > 0
    ? Math.round((citizen.votesWithMajority / citizen.votesCast) * 100)
    : 0

  // Display name: auth context name > stored profile name > truncated wallet
  const stored = typeof window !== 'undefined' ? localStorage.getItem('citizen_profile') : null
  const storedName = stored ? JSON.parse(stored).name : null
  const displayName = user?.name && !user.name.includes('...') ? user.name : storedName || user?.name || '—'

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Demo notice */}
      {isDemo && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 px-4 py-2 text-center">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Демо-режим — отображаются тестовые данные.{' '}
            <Link href="/register" className="font-semibold underline">Зарегистрироваться по-настоящему</Link>
          </p>
        </div>
      )}

      {/* Profile header */}
      <div className={`bg-gradient-to-b ${tier.bg} border-b ${tier.border}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Avatar */}
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${tier.bg} border-2 ${tier.border} flex items-center justify-center shadow-lg`}>
              <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" className={tier.color} viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border bg-gradient-to-r ${tier.bg} ${tier.color} ${tier.border}`}>
                  {tierLabel}
                </span>
              </div>
              {!isDemo && (
                <div className="text-gray-500 dark:text-gray-400 text-sm font-mono mb-3">
                  {citizen.walletAddress.slice(0, 6)}...{citizen.walletAddress.slice(-4)}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {citizen.district} {t('district')}
              </div>
            </div>

            {/* Reputation */}
            <div className="sm:text-right">
              <div className={`text-5xl font-black ${tier.color} mb-1`}>{citizen.reputationScore}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">{t('reputationPoints')}</div>
              {nextTierLabel && (
                <div className="mt-2">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                    {t('until')} {nextTierLabel}: {tier.max - citizen.reputationScore} {t('points')}
                  </div>
                  <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full ml-auto">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                      style={{ width: `${Math.min(100, Math.max(0, progressToNext))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: t('votesCast'),    value: citizen.votesCast,          color: 'text-blue-600 dark:text-blue-400',     icon: '🗳️' },
            { label: t('accuracy'),     value: `${accuracy}%`,             color: 'text-emerald-600 dark:text-emerald-400', icon: '🎯' },
            { label: t('jurySessions'), value: citizen.votesCast,          color: 'text-purple-600 dark:text-purple-400', icon: '⚖️' },
            { label: 'Пропущено',       value: citizen.missedJuryCount,    color: 'text-red-500 dark:text-red-400',       icon: '⚠️' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className={`text-2xl font-bold ${stat.color} mb-0.5`}>{stat.value}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ADL Token wallet */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Кошелёк ADL</h2>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 font-bold text-xs">ADL</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-emerald-400">
                  {onChainBalance !== null ? formatBalance(onChainBalance) : formatBalance(tokenWallet.balance)}
                </span>
                {onChainBalance !== null && (
                  <div className="text-xs text-emerald-600">on-chain</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {onChainBalance !== null
                ? 'Реальный SPL-токен на Solana devnet. Начисляется за активность в протоколе.'
                : 'Токен Amanat Protocol. Начисляется за активность: голосования, регистрация, краудфандинг.'}
            </div>
          </div>

          {tokenWallet.transactions.length > 0 ? (
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">Последние начисления</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tokenWallet.transactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div>
                      <span className="text-gray-900 dark:text-white">{tx.description}</span>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(tx.timestamp).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className="text-emerald-500 font-semibold">+{tx.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">
              Пока нет транзакций. Совершайте действия, чтобы получать ADL!
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Информация о гражданине</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Имя</span>
              <span className="text-gray-900 dark:text-white font-medium">{displayName}</span>
            </div>
            {!isDemo && (
              <div className="flex justify-between">
                <span className="text-gray-400">Кошелёк</span>
                <span className="text-gray-900 dark:text-white font-mono text-xs">{citizen.walletAddress}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Район</span>
              <span className="text-gray-900 dark:text-white">{citizen.district}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Уровень</span>
              <span className={tier.color}>{tierLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Репутация</span>
              <span className="text-gray-900 dark:text-white font-bold">{citizen.reputationScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Голосов отдано</span>
              <span className="text-gray-900 dark:text-white">{citizen.votesCast}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Совпадений с большинством</span>
              <span className="text-gray-900 dark:text-white">{citizen.votesWithMajority}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
