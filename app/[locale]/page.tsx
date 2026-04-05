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
    { label: t('contractsMonitored'), value: String(stats.contracts), icon: '📋', color: 'text-blue-600 dark:text-blue-400', href: '/contracts' as const },
    { label: t('totalAmount'), value: formatBigAmount(stats.totalAmount), icon: '💰', color: 'text-emerald-600 dark:text-emerald-400', href: '/treasury/Ауэзовский' as const },
    { label: t('violationsFound'), value: String(stats.penalized), icon: '⚠️', color: 'text-red-500 dark:text-red-400', href: '/contracts' as const },
    { label: t('jurorCitizens'), value: String(stats.citizens), icon: '👥', color: 'text-purple-600 dark:text-purple-400', href: '/register' as const },
  ]

  const ROLE_CARDS = [
    { icon: '\u{1F464}', title: t('forCitizens'), desc: t('forCitizensDesc'), href: '/register' as const },
    { icon: '\u{1F3D7}\uFE0F', title: t('forContractors'), desc: t('forContractorsDesc'), href: '/register-contractor' as const },
    { icon: '\u{1F3DB}\uFE0F', title: t('forAkimat'), desc: t('forAkimatDesc'), href: '/register-akimat' as const },
  ]

  const LEGEND = [
    { color: '#10b981', label: t('onTime') },
    { color: '#f59e0b', label: t('risk') },
    { color: '#ef4444', label: t('overdueOrPenalty') },
    { color: '#3b82f6', label: t('completed') },
  ]

  return (
    <main className={`${user ? 'h-screen' : 'min-h-screen'} flex flex-col pt-16 bg-gray-50 dark:bg-gray-950`}>
      <Onboarding />

      {/* Hero section — only for unauthenticated users */}
      {!user && (
        <section className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            {/* Title block */}
            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-3">
                {t('heroTitle')}
              </h1>
              <p className="text-lg sm:text-xl text-emerald-600 dark:text-emerald-400 font-medium mb-4">
                {t('heroSubtitle')}
              </p>
              <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
                {t('heroDescription')}
              </p>
            </div>

            {/* Role cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto mb-8">
              {ROLE_CARDS.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group block bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-gray-900/80 transition-all duration-200"
                >
                  <div className="text-3xl mb-3">{card.icon}</div>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-base mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                    {card.desc}
                  </p>
                </Link>
              ))}
            </div>

            {/* How it works link */}
            <div className="text-center">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('start-onboarding'))}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-sm font-medium transition-colors inline-flex items-center gap-1.5"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
                </svg>
                {t('howItWorks')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Social proof strip — only for unauthenticated users */}
      {!user && (
        <div className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {t('blockchainStrip')}
            </div>
            <Link
              href="/blockchain"
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
            >
              {t('checkExplorer')} &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Stats banner */}
      <div className="bg-white dark:bg-gray-950/95 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-6">
              {STATS.map((stat) => (
                <Link key={stat.label} href={stat.href} className="flex items-center gap-2 group">
                  <span className="text-lg">{stat.icon}</span>
                  <div>
                    <div className={`font-bold text-lg leading-none group-hover:underline ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                  </div>
                </Link>
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
      <div className={`${user ? 'flex-1' : 'h-[70vh]'} relative`}>
        <AlmatyMap />

        <TransactionFeed variant="floating" maxItems={6} includeDemo={false} />

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
