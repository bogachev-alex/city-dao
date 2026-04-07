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

function formatBigAmount(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} млрд ₸`
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)} млн ₸`
  return `${val.toLocaleString('ru-KZ')} ₸`
}

/* ─── Landing page (unauthenticated) ─── */
function LandingPage() {
  const t = useTranslations('landing')

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 pt-16">

      {/* ════════ HERO ════════ */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 via-white to-white dark:from-emerald-950/20 dark:via-gray-950 dark:to-gray-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t('badge')}</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-center text-gray-900 dark:text-white leading-[1.1] mb-6">
            {t('headline1')}<br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
              {t('headline2')}
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 text-center max-w-3xl mx-auto mb-10 leading-relaxed">
            {t('subheadline')}
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 text-center"
            >
              {t('ctaPrimary')}
            </Link>
            <Link
              href="/contracts"
              className="w-full sm:w-auto px-8 py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-base font-semibold transition-all text-center"
            >
              {t('ctaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* ════════ LIVE MAP SECTION ════════ */}
      <section className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">{t('mapTitle')}</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{t('mapSubtitle')}</p>
          </div>
        </div>
        <div className="h-[500px] relative border-t border-b border-gray-200 dark:border-gray-800">
          <AlmatyMap />
          <TransactionFeed variant="floating" maxItems={6} includeDemo={false} />
        </div>
      </section>

      {/* ════════ PROBLEM → SOLUTION ════════ */}
      <section className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Problem */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 mb-6">
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">{t('problemBadge')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('problemTitle')}</h2>
              <div className="space-y-4">
                {(['problem1', 'problem2', 'problem3'] as const).map((key) => (
                  <div key={key} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="14" height="14" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{t(key)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 mb-6">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t('solutionBadge')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('solutionTitle')}</h2>
              <div className="space-y-4">
                {(['solution1', 'solution2', 'solution3'] as const).map((key) => (
                  <div key={key} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{t(key)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ HOW IT WORKS ════════ */}
      <section className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">{t('howTitle')}</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{t('howSubtitle')}</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 sm:gap-8">
            {([
              { step: '01', icon: 'register', key: 'step1' },
              { step: '02', icon: 'contract', key: 'step2' },
              { step: '03', icon: 'monitor', key: 'step3' },
              { step: '04', icon: 'vote', key: 'step4' },
            ] as const).map((item) => (
              <div key={item.key} className="relative">
                <div className="text-5xl font-black text-emerald-100 dark:text-emerald-500/10 mb-3">{item.step}</div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{t(`${item.key}Title`)}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{t(`${item.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ STAKEHOLDERS ════════ */}
      <section className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">{t('stakeholdersTitle')}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {([
              { icon: '👤', role: 'citizen', color: 'emerald', href: '/register' as const },
              { icon: '🏗️', role: 'contractor', color: 'blue', href: '/register-contractor' as const },
              { icon: '🏛️', role: 'akimat', color: 'purple', href: '/register-akimat' as const },
            ] as const).map((card) => (
              <Link
                key={card.role}
                href={card.href}
                className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300"
              >
                <div className="text-4xl mb-4">{card.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {t(`${card.role}Title`)}
                </h3>
                <ul className="space-y-2.5 mb-6">
                  {(['f1', 'f2', 'f3'] as const).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                      {t(`${card.role}_${f}`)}
                    </li>
                  ))}
                </ul>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                  {t(`${card.role}Cta`)} &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ TECH / TRUST ════════ */}
      <section className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">{t('techTitle')}</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">{t('techSubtitle')}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {([
              { icon: 'solana', key: 'tech1' },
              { icon: 'escrow', key: 'tech2' },
              { icon: 'jury', key: 'tech3' },
              { icon: 'ai', key: 'tech4' },
            ] as const).map((item) => (
              <div key={item.key} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
                  {item.icon === 'solana' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 17.5h13.5l2.5-2.5H6.5L4 17.5z" fill="#10b981"/><path d="M4 6.5L6.5 9H20l-2.5-2.5H4z" fill="#10b981"/><path d="M6.5 12l-2.5 2.5h13.5l2.5-2.5H6.5z" fill="#10b981" opacity="0.6"/></svg>}
                  {item.icon === 'escrow' && <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                  {item.icon === 'jury' && <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
                  {item.icon === 'ai' && <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0110 10 10 10 0 01-10 10A10 10 0 012 12 10 10 0 0112 2z"/><path d="M12 6v6l4 2"/></svg>}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t(`${item.key}Title`)}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{t(`${item.key}Desc`)}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/blockchain"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              {t('techExplorer')} &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">{t('ctaTitle')}</h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-2xl mx-auto">{t('ctaSubtitle')}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 text-center"
            >
              {t('ctaButton')}
            </Link>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('start-onboarding'))}
              className="w-full sm:w-auto px-8 py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-base font-semibold transition-all text-center"
            >
              {t('ctaDemo')}
            </button>
          </div>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700 dark:text-gray-300">STRAITA</span>
            <span>&middot;</span>
            <span>{t('footer')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{t('builtOn')}</span>
            <span className="font-semibold text-gray-600 dark:text-gray-400">Solana</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

/* ─── Authenticated dashboard (original) ─── */
function DashboardPage({ stats, formatAmount, t }: {
  stats: { contracts: number; totalAmount: number; penalized: number; citizens: number }
  formatAmount: (n: number) => string
  t: ReturnType<typeof useTranslations<'home'>>
}) {
  const { user } = useAuth()

  const STATS = [
    { label: t('contractsMonitored'), value: String(stats.contracts), icon: '📋', color: 'text-blue-600 dark:text-blue-400', href: '/contracts' as const },
    { label: t('totalAmount'), value: formatAmount(stats.totalAmount), icon: '💰', color: 'text-emerald-600 dark:text-emerald-400', href: '/treasury/Ауэзовский' as const },
    { label: t('violationsFound'), value: String(stats.penalized), icon: '⚠️', color: 'text-red-500 dark:text-red-400', href: '/contracts' as const },
    { label: t('jurorCitizens'), value: String(stats.citizens), icon: '👥', color: 'text-purple-600 dark:text-purple-400', href: '/register' as const },
  ]

  const LEGEND = [
    { color: '#10b981', label: t('onTime') },
    { color: '#f59e0b', label: t('risk') },
    { color: '#ef4444', label: t('overdueOrPenalty') },
    { color: '#3b82f6', label: t('completed') },
  ]

  return (
    <main className="h-screen flex flex-col pt-16 bg-gray-50 dark:bg-gray-950">
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
      <div className="flex-1 relative">
        <AlmatyMap />
        <TransactionFeed variant="floating" maxItems={6} includeDemo={false} />

        {/* Legend */}
        <div className="absolute bottom-6 left-4 z-[1000] bg-white dark:bg-gray-950/90 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-3 uppercase tracking-wider">{t('contractStatuses')}</div>
          <div className="space-y-2">
            {LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}40` }} />
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
              <div className="text-gray-500 dark:text-gray-400 text-xs">{t('markerDescription')}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

/* ─── Root page component ─── */
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

  if (!user) {
    return <LandingPage />
  }

  return <DashboardPage stats={stats} formatAmount={formatBigAmount} t={t} />
}
