'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { useAuth } from '@/components/AuthContext'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import WorkLogFormModal from '@/components/contractor/WorkLogFormModal'
import MilestoneSubmitModal from '@/components/contractor/MilestoneSubmitModal'
import { formatTengeWithCrypto } from '@/lib/contracts'

type Milestone = {
  id: string
  status: string
  description: string
  sortOrder: number
}

type ApiContract = {
  id: string
  title: string
  district: string
  status: string
  deadline: string
  totalAmount: string | bigint
  onChainPubkey?: string | null
  milestones: Milestone[]
  penalties?: { id: string; amountTenge: string | number; type: string }[]
  jurySessions?: {
    id: string
    status: 'SELECTING' | 'COMMIT_PHASE' | 'REVEAL_PHASE' | 'FINALIZED' | 'ESCALATED' | string
    commitDeadline?: string | null
    revealDeadline?: string | null
  }[]
}

type ApiWorkLog = {
  id: string
  type: string
  title: string
  description: string | null
  createdAt: string
  completionPct: number | null
  contract: { id: string; title: string; district: string }
}

type ContractorPayload = {
  id: string
  name: string
  walletAddress?: string | null
  rating: string
  reputationScore: number
  onTimeRate: number
  acceptanceRate: number
  updateFrequency: number
  contracts: ApiContract[]
  workLogs: ApiWorkLog[]
}

function daysUntil(deadlineIso: string): number {
  return Math.ceil((new Date(deadlineIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function contractProgress(c: ApiContract): { done: number; total: number; pct: number } {
  const ms = c.milestones || []
  const total = ms.length || 1
  const done = ms.filter((m) => m.status === 'ACCEPTED').length
  return { done, total, pct: Math.round((done / total) * 100) }
}

const LOG_TYPE_LABEL: Record<string, string> = {
  DAILY_LOG: 'Дневник',
  MILESTONE_CLAIM: 'Этап',
  BLOCKER: 'Блокер',
  MATERIAL_DELIVERY: 'Поставка',
}
const MIN_SOL_WARN = 0.02

function formatPhaseLeft(ms: number): string {
  const h = Math.max(0, Math.ceil(ms / (1000 * 60 * 60)))
  return `${h}h`
}

export default function ContractorCabinetPage() {
  const t = useTranslations('contractorPage')
  const tNav = useTranslations('nav')
  const locale = useLocale()
  const { user, loading: authLoading, authHeader } = useAuth()
  const { connection } = useConnection()
  const wallet = useWallet()
  const router = useRouter()
  const [data, setData] = useState<ContractorPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [workLogModalOpen, setWorkLogModalOpen] = useState(false)
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [solBalance, setSolBalance] = useState<number | null>(null)
  const [loadingSol, setLoadingSol] = useState(false)
  const [blockerNotice, setBlockerNotice] = useState<string | null>(null)

  const loadContractor = useCallback(async () => {
    if (!user || user.role !== 'CONTRACTOR') return
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch(`/api/contractors?id=${encodeURIComponent(user.id)}`, {
        headers: { ...authHeader() },
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'not_found')
      }
      const json = (await r.json()) as ContractorPayload
      setData(json)
    } catch {
      setLoadError('not_found')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [user, authHeader])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login' as any)
      return
    }
    if (user.role !== 'CONTRACTOR') {
      router.replace('/' as any)
      return
    }
    void loadContractor()
  }, [user, authLoading, router, loadContractor])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null
    async function refresh() {
      if (!wallet.publicKey) {
        if (alive) setSolBalance(null)
        return
      }
      try {
        if (alive) setLoadingSol(true)
        const lamports = await connection.getBalance(wallet.publicKey)
        if (alive) setSolBalance(lamports / LAMPORTS_PER_SOL)
      } finally {
        if (alive) setLoadingSol(false)
      }
    }
    void refresh()
    if (wallet.publicKey) timer = setInterval(() => void refresh(), 15000)
    return () => {
      alive = false
      if (timer) clearInterval(timer)
    }
  }, [connection, wallet.publicKey])

  const stats = useMemo(() => {
    if (!data?.contracts) return null
    const contracts = data.contracts
    const active = contracts.filter((c) => c.status === 'ACTIVE').length
    const atRisk = contracts.filter((c) => {
      if (c.status !== 'ACTIVE') return false
      const d = daysUntil(c.deadline)
      return d >= 0 && d < 7
    }).length
    const overdue = contracts.filter((c) => c.status === 'PENALIZED').length
    const disputed = contracts.filter((c) => c.status === 'DISPUTED').length
    return { active, atRisk, overdue, disputed, total: contracts.length }
  }, [data])

  const attention = useMemo(() => {
    if (!data?.contracts?.length) return { reviewMilestones: 0, contractsWithReview: [] as ApiContract[] }
    const contractsWithReview: ApiContract[] = []
    let reviewMilestones = 0
    for (const c of data.contracts) {
      const n = (c.milestones || []).filter((m) => m.status === 'UNDER_REVIEW').length
      if (n > 0) {
        reviewMilestones += n
        contractsWithReview.push(c)
      }
    }
    return { reviewMilestones, contractsWithReview }
  }, [data])

  const activeBlockersByContract = useMemo(() => {
    const map = new Map<string, ApiWorkLog>()
    if (!data) return map
    const now = Date.now()
    for (const log of data.workLogs) {
      if (log.type !== 'BLOCKER') continue
      const ageMs = now - new Date(log.createdAt).getTime()
      if (ageMs > 72 * 60 * 60 * 1000) continue
      if (!map.has(log.contract.id)) map.set(log.contract.id, log)
    }
    return map
  }, [data])

  const solWarn = solBalance != null && solBalance < MIN_SOL_WARN

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || user.role !== 'CONTRACTOR') return null

  if (loadError || !data) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-3">🏗️</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('notFoundTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{t('notFoundLead')}</p>
          <Link href="/contracts" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
            {t('goContracts')}
          </Link>
        </div>
      </div>
    )
  }

  const ratingClass =
    data.rating === 'AAA'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
      : data.rating === 'AA'
        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
        : 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30'

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 dark:from-gray-900 dark:to-gray-950 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div>
              <p className="text-emerald-400/90 text-sm font-medium mb-2 uppercase tracking-wider">{t('badge')}</p>
              <h1 className="text-3xl font-bold text-white mb-2">{data.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold border ${ratingClass}`}>
                  {t('rating')}: {data.rating}
                </span>
                <span className="text-gray-400 text-sm">
                  {t('reputation')}: <span className="text-white font-semibold">{data.reputationScore}</span>
                </span>
                <span
                  className={`inline-flex px-3 py-1 rounded-lg text-xs font-semibold border ${
                    !wallet.publicKey
                      ? 'bg-gray-500/10 text-gray-300 border-gray-500/30'
                      : solWarn
                        ? 'bg-red-500/15 text-red-300 border-red-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {!wallet.publicKey
                    ? t('walletNotConnected')
                    : loadingSol
                      ? t('solLoading')
                      : t('solBalance', { value: (solBalance ?? 0).toFixed(4) })}
                </span>
              </div>
              {wallet.publicKey && solWarn && (
                <p className="mt-2 text-xs text-red-300">
                  {t('solLowWarning', { min: MIN_SOL_WARN })}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 w-full lg:w-auto lg:min-w-[420px]">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-white">{stats?.active ?? 0}</div>
                <div className="text-xs text-gray-400 mt-1">{t('kpiActive')}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-amber-400">{stats?.atRisk ?? 0}</div>
                <div className="text-xs text-gray-400 mt-1">{t('kpiRisk')}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-red-400">{stats?.overdue ?? 0}</div>
                <div className="text-xs text-gray-400 mt-1">{t('kpiPenalized')}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-violet-400">{stats?.disputed ?? 0}</div>
                <div className="text-xs text-gray-400 mt-1">{t('kpiDisputed')}</div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">{t('metricOnTime')}</div>
              <div className="text-lg font-semibold text-white">{Math.round(data.onTimeRate * 100)}%</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">{t('metricAccept')}</div>
              <div className="text-lg font-semibold text-white">{Math.round(data.acceptanceRate * 100)}%</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">{t('metricUpdates')}</div>
              <div className="text-lg font-semibold text-white">{Math.round(data.updateFrequency * 100)}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {blockerNotice && (
          <section className="rounded-xl border border-orange-400/40 bg-orange-500/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-orange-900 dark:text-orange-200">{blockerNotice}</p>
              <button
                type="button"
                onClick={() => setBlockerNotice(null)}
                className="text-xs text-orange-800 dark:text-orange-300 hover:underline"
              >
                {t('dismiss')}
              </button>
            </div>
          </section>
        )}
        {attention.reviewMilestones > 0 && (
          <section
            className="rounded-xl border border-amber-500/40 bg-amber-500/15 dark:bg-amber-500/10 px-4 py-4"
            aria-live="polite"
          >
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">{t('attentionTitle')}</h2>
            <p className="text-sm text-amber-700 dark:text-amber-300/90 mb-3">
              {t('attentionLead', { count: attention.reviewMilestones })}
            </p>
            <ul className="space-y-2">
              {attention.contractsWithReview.map((c) => {
                const n = (c.milestones || []).filter((m) => m.status === 'UNDER_REVIEW').length
                return (
                  <li key={c.id}>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="text-sm font-medium text-amber-800 dark:text-amber-200 hover:underline"
                    >
                      {c.title} — {t('attentionStages', { count: n })}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t('toolStagesTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{t('toolStagesBody')}</p>
            <Link href="/contracts" className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
              {t('toolStagesCta')} →
            </Link>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t('toolLogTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{t('toolLogBody')}</p>
            {data.contracts[0] ? (
              <Link
                href={`/contracts/${data.contracts[0].id}`}
                className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {t('toolLogCta')} →
              </Link>
            ) : (
              <span className="text-sm text-gray-400">{t('toolLogEmpty')}</span>
            )}
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t('toolReputationTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{t('toolReputationBody')}</p>
            <Link href="/contracts" className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
              {t('toolReputationCta')} →
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-emerald-500">⚡</span>
            {t('actionsTitle')}
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setWorkLogModalOpen(true)}
              disabled={!data.contracts.length}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors border border-slate-600 disabled:opacity-40 disabled:pointer-events-none"
            >
              {t('addReport')}
            </button>
            <button
              type="button"
              onClick={() => setMilestoneModalOpen(true)}
              disabled={!data.contracts.length}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {t('submitMilestone')}
            </button>
            <Link
              href="/contracts"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
            >
              {t('actionContracts')}
            </Link>
            <Link
              href="/blockchain"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium hover:border-emerald-500/40 transition-colors"
            >
              {t('actionBlockchain')}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium hover:border-emerald-500/40 transition-colors"
            >
              {tNav('map')}
            </Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 max-w-2xl">{t('actionsHint')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('contractsTitle')}</h2>
          {data.contracts.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              {t('noContracts')}
            </div>
          ) : (
            <div className="space-y-3">
              {data.contracts.map((c) => {
                const { done, total, pct } = contractProgress(c)
                const dLeft = daysUntil(c.deadline)
                const risk = c.status === 'ACTIVE' && dLeft >= 0 && dLeft < 7
                const review = (c.milestones || []).some((m) => m.status === 'UNDER_REVIEW')
                const activeBlocker = activeBlockersByContract.get(c.id)
                const penalties = c.penalties || []
                const penaltyTotal = penalties.reduce((acc, p) => acc + Number(p.amountTenge || 0), 0)
                const latestJury = c.jurySessions?.[0]
                let juryStatusText: string | null = null
                if (latestJury) {
                  if (latestJury.status === 'SELECTING') {
                    juryStatusText = t('jurySelecting')
                  } else if (latestJury.status === 'COMMIT_PHASE') {
                    const left = latestJury.commitDeadline
                      ? new Date(latestJury.commitDeadline).getTime() - Date.now()
                      : null
                    juryStatusText = left != null ? t('juryCommitLeft', { hours: formatPhaseLeft(left) }) : t('juryCommit')
                  } else if (latestJury.status === 'REVEAL_PHASE') {
                    const left = latestJury.revealDeadline
                      ? new Date(latestJury.revealDeadline).getTime() - Date.now()
                      : null
                    juryStatusText = left != null ? t('juryRevealLeft', { hours: formatPhaseLeft(left) }) : t('juryReveal')
                  } else if (latestJury.status === 'FINALIZED') {
                    juryStatusText = t('juryFinalized')
                  }
                }

                return (
                  <div
                    key={c.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{c.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{c.district}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
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
                        {risk && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            {t('badgeRisk')}
                          </span>
                        )}
                        {review && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border border-yellow-500/30">
                            {t('badgeReview')}
                          </span>
                        )}
                        {!wallet.publicKey ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/30">
                            {t('walletNotConnected')}
                          </span>
                        ) : solWarn ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/30">
                            {t('solLowBadge')}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            {t('solOkBadge')}
                          </span>
                        )}
                        {activeBlocker && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                            {t('blockerActive')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatTengeWithCrypto(Number(c.totalAmount))}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {dLeft < 0 ? t('deadlineOverdue', { days: Math.abs(dLeft) }) : t('deadlineLeft', { days: dLeft })}
                      </span>
                    </div>
                    <div className="mb-3 space-y-1">
                      {c.status === 'ACTIVE' && dLeft >= 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          {t('penaltyCountdown', { days: dLeft })}
                        </p>
                      )}
                      {c.status === 'PENALIZED' && (
                        <p className="text-xs text-red-700 dark:text-red-300">
                          {t('penaltyRunning', { amount: new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ').format(penaltyTotal) })}
                        </p>
                      )}
                      {juryStatusText && (
                        <p className="text-xs text-violet-700 dark:text-violet-300">{juryStatusText}</p>
                      )}
                      {activeBlocker && (
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          {t('blockerRecordedAt', {
                            time: new Date(activeBlocker.createdAt).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }),
                          })}
                        </p>
                      )}
                    </div>
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{t('stagesProgress')}</span>
                        <span>
                          {done}/{total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="inline-flex text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {t('openContract')} →
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('logsTitle')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('logsHint')}</p>
          {data.workLogs.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              {t('noLogs')}
            </div>
          ) : (
            <div className="space-y-2">
              {data.workLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-gray-400">{LOG_TYPE_LABEL[log.type] || log.type}</span>
                      {log.completionPct != null && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">{log.completionPct}%</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{log.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {log.contract.title} · {log.contract.district}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                    <Link href={`/contracts/${log.contract.id}`} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                      {t('toContract')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <WorkLogFormModal
        open={workLogModalOpen}
        onClose={() => setWorkLogModalOpen(false)}
        contracts={data.contracts.map((c) => ({ id: c.id, title: c.title }))}
        authHeader={authHeader}
        onSuccess={(created) => {
          if (created?.type === 'BLOCKER') {
            setBlockerNotice(t('blockerRecorded'))
          }
          void loadContractor()
        }}
      />
      <MilestoneSubmitModal
        open={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        contracts={data.contracts.map((c) => ({
          id: c.id,
          title: c.title,
          onChainPubkey: c.onChainPubkey,
          milestones: c.milestones,
        }))}
        contractorWalletAddress={data.walletAddress}
        authHeader={authHeader}
        onSuccess={() => void loadContractor()}
      />
    </div>
  )
}
