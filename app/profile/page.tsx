'use client'

import { useState } from 'react'
import Link from 'next/link'

const MOCK_PROFILE = {
  address: '0xA3f2...9D2b',
  district: 'Медеуский',
  reputation: 340,
  tier: 'Silver' as 'Bronze' | 'Silver' | 'Gold',
  stats: {
    votesCast: 23,
    accuracy: 87,
    rewardsEarned: 450,
    juryAssignments: 8,
  },
}

const VOTING_HISTORY = [
  { id: '1', contract: 'Ремонт тротуара, набережная Весновки', milestone: 'Укладка основания', vote: 'accept', outcome: 'correct', repChange: +15, date: '25.03.2026' },
  { id: '2', contract: 'Замена электросетей мкр. Акжар', milestone: 'Проектная документация', vote: 'accept', outcome: 'correct', repChange: +15, date: '20.03.2026' },
  { id: '3', contract: 'Ямочный ремонт ул. Яссауи', milestone: 'Подготовительные работы', vote: 'reject', outcome: 'incorrect', repChange: +5, date: '15.03.2026' },
  { id: '4', contract: 'Строительство детского сада мкр. Курамыс', milestone: 'Фундамент', vote: 'accept', outcome: 'correct', repChange: +15, date: '10.03.2026' },
]

const TIER_CONFIG = {
  Bronze: { color: 'text-orange-500 dark:text-orange-400', bg: 'from-orange-50 to-orange-100', border: 'border-orange-200 dark:border-orange-500/30', min: 0, max: 200 },
  Silver: { color: 'text-gray-500 dark:text-gray-400', bg: 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700', border: 'border-gray-300 dark:border-gray-600', min: 200, max: 500 },
  Gold: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200 dark:border-yellow-500/30', min: 500, max: 1000 },
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'votes' | 'jury'>('votes')
  const tier = TIER_CONFIG[MOCK_PROFILE.tier]
  const nextTier = MOCK_PROFILE.tier === 'Bronze' ? 'Silver' : MOCK_PROFILE.tier === 'Silver' ? 'Gold' : null
  const progressToNext = nextTier
    ? Math.round(((MOCK_PROFILE.reputation - tier.min) / (tier.max - tier.min)) * 100)
    : 100

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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Гражданин Алматы</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border bg-gradient-to-r ${tier.bg} ${tier.color} ${tier.border}`}>
                  {MOCK_PROFILE.tier}
                </span>
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-sm font-mono mb-3">{MOCK_PROFILE.address}</div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {MOCK_PROFILE.district} район
              </div>
            </div>

            {/* Reputation */}
            <div className="sm:text-right">
              <div className={`text-5xl font-black ${tier.color} mb-1`}>{MOCK_PROFILE.reputation}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">очков репутации</div>
              {nextTier && (
                <div className="mt-2">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">До {nextTier}: {tier.max - MOCK_PROFILE.reputation} очков</div>
                  <div className="w-32 h-1.5 bg-gray-200 rounded-full ml-auto">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${
                        MOCK_PROFILE.tier === 'Bronze' ? 'from-orange-500 to-orange-400' : 'from-gray-400 to-gray-300'
                      }`}
                      style={{ width: `${progressToNext}%` }}
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
            { label: 'Голосов подано', value: MOCK_PROFILE.stats.votesCast, color: 'text-blue-600 dark:text-blue-400', icon: '🗳️' },
            { label: 'Точность', value: `${MOCK_PROFILE.stats.accuracy}%`, color: 'text-emerald-600 dark:text-emerald-400', icon: '🎯' },
            { label: 'Наград получено', value: `${MOCK_PROFILE.stats.rewardsEarned} USDC`, color: 'text-yellow-600 dark:text-yellow-400', icon: '💰' },
            { label: 'Сессий жюри', value: MOCK_PROFILE.stats.juryAssignments, color: 'text-purple-600 dark:text-purple-400', icon: '⚖️' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className={`text-2xl font-bold ${stat.color} mb-0.5`}>{stat.value}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1">
          {[
            { id: 'votes', label: 'История голосований' },
            { id: 'jury', label: 'Сессии жюри' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'votes' | 'jury')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Voting history */}
        {activeTab === 'votes' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">
              <div className="col-span-2">Контракт</div>
              <div>Голос</div>
              <div>Результат</div>
              <div className="text-right">Репутация</div>
            </div>
            {VOTING_HISTORY.map((entry, i) => (
              <div
                key={entry.id}
                className={`grid grid-cols-5 gap-4 px-5 py-4 items-center ${i < VOTING_HISTORY.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}
              >
                <div className="col-span-2">
                  <div className="text-gray-900 dark:text-white text-sm font-medium truncate">{entry.contract}</div>
                  <div className="text-gray-400 dark:text-gray-500 text-xs truncate">{entry.milestone}</div>
                  <div className="text-gray-400 dark:text-gray-500 text-xs">{entry.date}</div>
                </div>
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    entry.vote === 'accept'
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    {entry.vote === 'accept' ? 'Принял' : 'Отклонил'}
                  </span>
                </div>
                <div>
                  <span className={`text-xs font-medium ${
                    entry.outcome === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {entry.outcome === 'correct' ? '✓ Верно' : '~ Меньшинство'}
                  </span>
                </div>
                <div className={`text-right font-bold ${entry.repChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  +{entry.repChange}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Jury assignments */}
        {activeTab === 'jury' && (
          <div className="space-y-3">
            {VOTING_HISTORY.map((entry) => (
              <div key={entry.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 dark:text-white text-sm font-medium truncate">{entry.contract}</div>
                  <div className="text-gray-400 dark:text-gray-500 text-xs">{entry.milestone} • {entry.date}</div>
                </div>
                <div className={`text-sm font-bold ${entry.outcome === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  +{entry.repChange} rep
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
