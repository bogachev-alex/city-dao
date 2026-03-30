'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { useAuth } from '@/components/AuthContext'
import { formatTengeWithCrypto } from '@/lib/contracts'

type Overview = {
  totalContracts: number
  activeContracts: number
  disputedContracts: number
  penalizedContracts: number
  citizensCount: number
  votingProposalsTotal: number
  totalTreasuryBalance: string
  treasuries: { district: string; balance: string; votingCount: number }[]
  recentContracts: {
    id: string
    title: string
    district: string
    status: string
    totalAmount: string
    createdAt: string
    contractorName: string
  }[]
}

export default function AkimatCabinetPage() {
  const t = useTranslations('akimatPage')
  const locale = useLocale()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login' as any)
      return
    }
    if (user.role !== 'AKIMAT') {
      router.replace('/' as any)
      return
    }

    setLoading(true)
    setError(false)
    fetch('/api/akimat/overview')
      .then(async (r) => {
        if (!r.ok) throw new Error('fail')
        return r.json()
      })
      .then((json: Overview) => setData(json))
      .catch(() => {
        setError(true)
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || user.role !== 'AKIMAT') return null

  if (error || !data) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-3">🏛️</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('loadErrorTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{t('loadErrorLead')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  const displayName = user.name

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      <div className="bg-gradient-to-b from-emerald-950 to-slate-950 border-b border-emerald-900/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-emerald-400/90 text-sm font-medium mb-2 uppercase tracking-wider">{t('badge')}</p>
          <h1 className="text-3xl font-bold text-white mb-2">{displayName}</h1>
          <p className="text-emerald-200/80 text-sm max-w-2xl">{t('subtitle')}</p>

          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{data.totalContracts}</div>
              <div className="text-xs text-gray-400 mt-1">{t('kpiContracts')}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-emerald-400">{data.activeContracts}</div>
              <div className="text-xs text-gray-400 mt-1">{t('kpiActive')}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-amber-400">{data.disputedContracts + data.penalizedContracts}</div>
              <div className="text-xs text-gray-400 mt-1">{t('kpiIssues')}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-violet-400">{data.citizensCount}</div>
              <div className="text-xs text-gray-400 mt-1">{t('kpiCitizens')}</div>
            </div>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">{t('totalTreasury')}</div>
              <div className="text-lg font-semibold text-white">{formatTengeWithCrypto(Number(data.totalTreasuryBalance))}</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">{t('votingProposals')}</div>
              <div className="text-lg font-semibold text-white">{data.votingProposalsTotal}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-emerald-500">⚡</span>
            {t('actionsTitle')}
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
            >
              {t('actionRegister')}
            </Link>
            <Link
              href="/contracts"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium hover:border-emerald-500/40 transition-colors"
            >
              {t('actionContracts')}
            </Link>
            <Link
              href="/crowdfunding"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium hover:border-emerald-500/40 transition-colors"
            >
              {t('actionCrowdfunding')}
            </Link>
            <Link
              href="/blockchain"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium hover:border-emerald-500/40 transition-colors"
            >
              {t('actionBlockchain')}
            </Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 max-w-2xl">{t('actionsHint')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('treasuryTitle')}</h2>
          {data.treasuries.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              {t('noTreasuries')}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.treasuries.map((row) => (
                <Link
                  key={row.district}
                  href={`/treasury/${encodeURIComponent(row.district)}`}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-emerald-500/40 transition-colors block"
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">{row.district}</div>
                  <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-2">
                    {formatTengeWithCrypto(Number(row.balance))}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('districtVoting', { count: row.votingCount })}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('recentTitle')}</h2>
          {data.recentContracts.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              {t('noRecent')}
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentContracts.map((c) => (
                <div
                  key={c.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{c.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {c.contractorName} · {c.district}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        c.status === 'ACTIVE'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                          : c.status === 'PENALIZED'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                            : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30'
                      }`}
                    >
                      {c.status}
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatTengeWithCrypto(Number(c.totalAmount))}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {
                        dateStyle: 'short',
                      })}
                    </span>
                    <Link href={`/contracts/${c.id}`} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                      {t('openContract')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
