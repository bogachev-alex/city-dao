'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useWallet } from '@solana/wallet-adapter-react'
import { fetchCitizen } from '@/lib/api'
import { Link } from '@/i18n/routing'

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

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; min: number; max: number }> = {
  NEW:      { color: 'text-gray-500 dark:text-gray-400', bg: 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700', border: 'border-gray-300 dark:border-gray-600', min: 0, max: 50 },
  ACTIVE:   { color: 'text-orange-500 dark:text-orange-400', bg: 'from-orange-50 to-orange-100', border: 'border-orange-200 dark:border-orange-500/30', min: 50, max: 150 },
  TRUSTED:  { color: 'text-blue-500 dark:text-blue-400', bg: 'from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800', border: 'border-blue-200 dark:border-blue-500/30', min: 150, max: 300 },
  GUARDIAN: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200 dark:border-yellow-500/30', min: 300, max: 1000 },
}

const TIER_LABELS: Record<string, string> = {
  NEW: 'Новичок',
  ACTIVE: 'Активный',
  TRUSTED: 'Доверенный',
  GUARDIAN: 'Хранитель',
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const { publicKey, connected } = useWallet()
  const [citizen, setCitizen] = useState<CitizenProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!connected || !publicKey) {
      setLoading(false)
      return
    }
    fetchCitizen(publicKey.toBase58())
      .then((data) => {
        if (data && !data.error) setCitizen(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [connected, publicKey])

  if (loading) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Подключите кошелёк</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Для просмотра профиля необходимо подключить Phantom кошелёк.</p>
        </div>
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
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Пройдите регистрацию, чтобы участвовать в голосованиях и контролировать контракты.</p>
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

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('citizenAlmaty')}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border bg-gradient-to-r ${tier.bg} ${tier.color} ${tier.border}`}>
                  {tierLabel}
                </span>
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-sm font-mono mb-3">
                {citizen.walletAddress.slice(0, 6)}...{citizen.walletAddress.slice(-4)}
              </div>
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
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{t('until')} {nextTierLabel}: {tier.max - citizen.reputationScore} {t('points')}</div>
                  <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full ml-auto">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                      style={{ width: `${Math.min(100, progressToNext)}%` }}
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
            { label: t('votesCast'), value: citizen.votesCast, color: 'text-blue-600 dark:text-blue-400', icon: '🗳️' },
            { label: t('accuracy'), value: `${accuracy}%`, color: 'text-emerald-600 dark:text-emerald-400', icon: '🎯' },
            { label: t('jurySessions'), value: citizen.votesCast, color: 'text-purple-600 dark:text-purple-400', icon: '⚖️' },
            { label: 'Пропущено', value: citizen.missedJuryCount, color: 'text-red-500 dark:text-red-400', icon: '⚠️' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className={`text-2xl font-bold ${stat.color} mb-0.5`}>{stat.value}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Info card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Информация о гражданине</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Кошелёк</span>
              <span className="text-gray-900 dark:text-white font-mono text-xs">{citizen.walletAddress}</span>
            </div>
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
