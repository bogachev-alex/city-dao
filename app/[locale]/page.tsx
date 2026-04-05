'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import TransactionFeed from '@/components/TransactionFeed'
import { useDataSource } from '@/lib/web3/useDataSource'
import { fetchAllContractsOnChain } from '@/lib/web3/onchain'
import { DEMO_CONTRACTS } from '@/lib/contracts'
import { useAuth } from '@/components/AuthContext'

const AlmatyMap = dynamic(() => import('@/components/AlmatyMap'), { ssr: false })
const Onboarding = dynamic(() => import('@/components/Onboarding'), { ssr: false })

function formatBigAmount(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} млрд ₸`
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)} млн ₸`
  return `${val.toLocaleString('ru-KZ')} ₸`
}

export default function HomePage() {
  const t = useTranslations('home')
  const dataSource = useDataSource()
  const { user } = useAuth()
  const [stats, setStats] = useState({ contracts: 0, totalAmount: 0, penalized: 0, citizens: 0 })

  useEffect(() => {
    Promise.all([
      fetch('/api/contracts').then((r) => r.json()).catch(() => []),
      fetch('/api/citizens').then((r) => r.json()).catch(() => []),
    ]).then(async ([contracts, citizens]) => {
      const contractList = Array.isArray(contracts) ? contracts : []
      const citizenList = Array.isArray(citizens) ? citizens : []

      if (contractList.length > 0) {
        setStats({
          contracts: contractList.length,
          totalAmount: contractList.reduce(
            (s: number, c: { totalAmount?: unknown; amount_usdc?: unknown }) =>
              s + Number(c.totalAmount ?? c.amount_usdc ?? 0),
            0
          ),
          penalized: contractList.filter((c: { status?: string }) => c.status === 'PENALIZED').length,
          citizens: citizenList.length,
        })
        return
      }

      if (dataSource === 'onchain') {
        try {
          const chain = await fetchAllContractsOnChain()
          const list = chain.length > 0 ? chain : DEMO_CONTRACTS
          setStats({
            contracts: list.length,
            totalAmount: list.reduce((s, c) => s + c.amount_usdc, 0),
            penalized: list.filter((c) => c.status === 'penalized').length,
            citizens: citizenList.length,
          })
        } catch {
          setStats({
            contracts: DEMO_CONTRACTS.length,
            totalAmount: DEMO_CONTRACTS.reduce((s, c) => s + c.amount_usdc, 0),
            penalized: DEMO_CONTRACTS.filter((c) => c.status === 'penalized').length,
            citizens: citizenList.length,
          })
        }
        return
      }

      setStats({
        contracts: DEMO_CONTRACTS.length,
        totalAmount: DEMO_CONTRACTS.reduce((s, c) => s + c.amount_usdc, 0),
        penalized: DEMO_CONTRACTS.filter((c) => c.status === 'penalized').length,
        citizens: citizenList.length,
      })
    })
  }, [dataSource])

  const STATS = [
    { label: t('contractsMonitored'), value: String(stats.contracts), icon: '📋', color: 'text-blue-600 dark:text-blue-400' },
    { label: t('totalAmount'), value: formatBigAmount(stats.totalAmount), icon: '💰', color: 'text-emerald-600 dark:text-emerald-400' },
    { label: t('violationsFound'), value: String(stats.penalized), icon: '⚠️', color: 'text-red-500 dark:text-red-400' },
    { label: t('jurorCitizens'), value: String(stats.citizens), icon: '👥', color: 'text-purple-600 dark:text-purple-400' },
  ]

  const LEGEND = [
    { color: '#10b981', label: t('onTime') },
    { color: '#f59e0b', label: t('risk') },
    { color: '#ef4444', label: t('overdueOrPenalty') },
    { color: '#3b82f6', label: t('completed') },
  ]

  return (
    <main className="h-screen flex flex-col pt-16 bg-gray-50 dark:bg-gray-950">
      <Onboarding />
      {/* Stats banner */}
      <div className="bg-white dark:bg-gray-950/95 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-6">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex items-center gap-2">
                  <span className="text-lg">{stat.icon}</span>
                  <div>
                    <div className={`font-bold text-lg leading-none ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Link
                href="/contracts"
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                {t('allContracts')}
              </Link>
              {!user && (
                <Link
                  href="/register"
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('becomeJuror')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        <AlmatyMap />

        <TransactionFeed variant="floating" maxItems={12} includeDemo={false} />

        {/* Legend */}
        <div className="absolute bottom-6 left-4 z-[1000] bg-white dark:bg-gray-950/90 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-3 uppercase tracking-wider">{t('contractStatuses')}</div>
          <div className="space-y-2">
            {LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ background: item.color, boxShadow: `0 0 6px ${item.color}40` }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info overlay */}
        <div className="absolute bottom-6 right-4 z-[1000] bg-white dark:bg-gray-950/90 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-lg max-w-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
              <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-gray-900 dark:text-white font-medium text-sm mb-1">{t('clickMarker')}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                {t('markerDescription')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
