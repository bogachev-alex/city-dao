'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import {
  Contract,
  ContractStatus,
  Milestone,
  getContractById,
  getDaysUntilDeadline,
  getMilestoneCompletedCount,
  formatTengeWithCrypto,
  normalizeContract,
  GOSZAKUP_ALMATY_WORKS_MIN10M_URL,
  resolveContractOnChainPubkey,
} from '@/lib/contracts'
import { isSolanaAddress } from '@/lib/blockchainDashboardModel'
import { fetchContract, fetchContractorName } from '@/lib/api'
import { useDataSource } from '@/lib/web3/useDataSource'
import { fetchAllContractsOnChain, fetchContractOnChain } from '@/lib/web3/onchain'
import { PublicKey } from '@solana/web3.js'
import MilestoneTracker from '@/components/MilestoneTracker'
import PenaltyCalculator from '@/components/PenaltyCalculator'
import { useAuth } from '@/components/AuthContext'
import { ownsContract } from '@/lib/ownsContract'
import { useWallet } from '@solana/wallet-adapter-react'
import { useContractRegistry } from '@/lib/web3/useContractRegistry'
import WorkLogFormModal from '@/components/contractor/WorkLogFormModal'
import MilestoneSubmitModal from '@/components/contractor/MilestoneSubmitModal'
import OnChainLink from '@/components/OnChainLink'
import ExternalLink from '@/components/ExternalLink'
import CryptoTooltip from '@/components/CryptoTooltip'

function milestoneStatusForApi(m: Milestone): string {
  const map: Record<Milestone['status'], string> = {
    pending: 'PENDING',
    submitted: 'SUBMITTED',
    under_review: 'UNDER_REVIEW',
    accepted: 'ACCEPTED',
    rejected: 'REJECTED',
    overdue: 'OVERDUE',
  }
  return map[m.status] || 'PENDING'
}

function normalizeText(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()"]/g, ' ')
    .replace(/\s+/g, ' ')
}

function tokenSet(v: string): Set<string> {
  return new Set(normalizeText(v).split(' ').filter((s) => s.length > 2))
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  a.forEach((t) => {
    if (b.has(t)) inter++
  })
  return inter / Math.max(a.size, b.size)
}

function shortAddress(value: string): string {
  if (!value) return value
  if (value.length <= 14) return value
  return `${value.slice(0, 6)}...${value.slice(-6)}`
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const t = useTranslations('contractDetail')
  const locale = useLocale()
  const { user, authHeader } = useAuth()
  const wallet = useWallet()
  const { registerContract: registerContractOnChain } = useContractRegistry()
  const dataSource = useDataSource()
  const showCitizenJuryVote = user?.role === 'CITIZEN'
  const [contract, setContract] = useState<Contract | null>(null)
  const [onChainSnapshot, setOnChainSnapshot] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [workLogModalOpen, setWorkLogModalOpen] = useState(false)
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [photoCids, setPhotoCids] = useState<string[]>([])
  const [photosLoading, setPhotosLoading] = useState(true)

  const applyOnChainOverlay = useCallback(async (base: Contract, overrideOnChainPubkey?: string | null): Promise<Contract> => {
    let pubkeyStr = overrideOnChainPubkey || resolveContractOnChainPubkey(base.id, base.onChainPubkey)
    if (!pubkeyStr) {
      try {
        // Fallback matching when DB record has no onChainPubkey yet.
        const candidates = await fetchAllContractsOnChain()
        const title = normalizeText(base.title)
        const titleTokens = tokenSet(base.title)
        const district = normalizeText(base.district)
        const amount = Number(base.amount_usdc || 0)

        let best: { id: string; score: number } | null = null
        for (const c of candidates) {
          const cDistrict = normalizeText(c.district)
          const cAmount = Number(c.amount_usdc || 0)
          const cTitle = normalizeText(c.title)
          const cTokens = tokenSet(c.title)

          const districtScore = cDistrict === district ? 1 : 0
          const textScore =
            cTitle === title
              ? 1
              : (cTitle.includes(title) || title.includes(cTitle) ? 0.85 : overlapScore(titleTokens, cTokens))

          let amountScore = 0
          if (amount > 0 && cAmount > 0) {
            const rel = Math.abs(cAmount - amount) / Math.max(amount, cAmount)
            if (rel <= 0.01) amountScore = 1
            else if (rel <= 0.05) amountScore = 0.7
            else if (rel <= 0.15) amountScore = 0.35
          }

          const score = districtScore * 0.35 + textScore * 0.5 + amountScore * 0.15
          if (!best || score > best.score) best = { id: c.id, score }
        }
        const matched = best && best.score >= 0.72 ? candidates.find((c) => c.id === best.id) : undefined
        if (matched) pubkeyStr = matched.id
      } catch {
        // keep DB-only view if chain lookup fails
      }
    }
    if (!pubkeyStr) {
      setOnChainSnapshot(null)
      return base
    }
    try {
      const onChain = await fetchContractOnChain(new PublicKey(pubkeyStr))
      if (!onChain) {
        setOnChainSnapshot(null)
        return base
      }
      setOnChainSnapshot(onChain)
      return {
        ...base,
        onChainPubkey: pubkeyStr,
      }
    } catch {
      setOnChainSnapshot(null)
      return base
    }
  }, [])

  const loadContract = useCallback(async () => {
    if (!params.id) return
    const overrideOnChainPubkey = searchParams.get('onchain')?.trim() || null
    setOnChainSnapshot(null)
    try {
      const data = await fetchContract(params.id)
      if (data && !data.error) {
        const normalized = normalizeContract(data)
        const withOnChain = await applyOnChainOverlay(normalized, overrideOnChainPubkey)
        setContract(withOnChain)
      } else {
        let pk: PublicKey | null = null
        try {
          pk = new PublicKey(params.id)
        } catch {
          pk = null
        }
        if (pk) {
          try {
            const onChain = await fetchContractOnChain(pk)
            if (onChain) {
              setOnChainSnapshot(onChain)
              setContract(await applyOnChainOverlay(onChain, overrideOnChainPubkey || params.id))
              return
            }
          } catch {
            // fall through to demo / not found
          }
        }
        const demo = getContractById(params.id)
        if (!demo) {
          setContract(null)
          return
        }
        const withOnChain = await applyOnChainOverlay(demo, overrideOnChainPubkey)
        setContract(withOnChain)
      }
    } catch {
      let pk: PublicKey | null = null
      try {
        pk = new PublicKey(params.id!)
      } catch {
        pk = null
      }
      if (pk) {
        try {
          const onChain = await fetchContractOnChain(pk)
          if (onChain) {
            setOnChainSnapshot(onChain)
            setContract(await applyOnChainOverlay(onChain, overrideOnChainPubkey || params.id))
            return
          }
        } catch {
          // fall through
        }
      }
      const demo = getContractById(params.id!)
      if (!demo) {
        setContract(null)
        return
      }
      const withOnChain = await applyOnChainOverlay(demo, overrideOnChainPubkey)
      setContract(withOnChain)
    }
  }, [applyOnChainOverlay, params.id, searchParams])

  const statusConfig = {
    active: { label: t('statusActive'), color: 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' },
    penalized: { label: t('statusPenalized'), color: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' },
    completed: { label: t('statusCompleted'), color: 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' },
    disputed: { label: t('statusDisputed'), color: 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30' },
  }

  // Resolve contractor wallet address to human-readable name
  useEffect(() => {
    if (!contract) return
    const addr = contract.contractorWalletAddress || contract.contractor
    // Solana base58 addresses are 32-44 chars of alphanumeric (no spaces/cyrillic)
    if (!addr || addr.length < 32 || addr.length > 44 || /[^A-Za-z0-9]/.test(addr)) return
    // contractor already shows a real name (not a wallet address)
    if (contract.contractor !== addr) return
    let cancelled = false
    fetchContractorName(addr).then((name) => {
      if (cancelled || !name) return
      setContract((prev) => prev ? { ...prev, contractor: name } : prev)
    })
    return () => { cancelled = true }
  }, [contract?.contractor, contract?.contractorWalletAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!params.id) return
    setLoading(true)

    // On-chain mode: try to fetch from Solana by PDA address
    if (dataSource === 'onchain') {
      (async () => {
        try {
          const overrideOnChainPubkey = searchParams.get('onchain')?.trim() || null
          const mappedOnChainPubkey = resolveContractOnChainPubkey(params.id, null)
          const candidatePubkey = overrideOnChainPubkey || mappedOnChainPubkey || params.id

          let onChain: Contract | null = null
          try {
            onChain = await fetchContractOnChain(new PublicKey(candidatePubkey))
          } catch {
            onChain = null
          }

          if (onChain) {
            setOnChainSnapshot(onChain)
            setContract(onChain)
          } else {
            const fallback = getContractById(params.id) || null
            if (!fallback) {
              setContract(null)
              return
            }
            const withOnChain = await applyOnChainOverlay(
              fallback,
              overrideOnChainPubkey || mappedOnChainPubkey
            )
            setContract(withOnChain)
          }
        } catch {
          setOnChainSnapshot(null)
          setContract(getContractById(params.id) || null)
        } finally {
          setLoading(false)
        }
      })()
      return
    }

    // Mock/DB mode: fetch from API
    void loadContract().finally(() => setLoading(false))
  }, [params.id, dataSource, loadContract, searchParams, applyOnChainOverlay])

  // Load photo evidence from work logs
  useEffect(() => {
    if (!contract?.id) return
    setPhotosLoading(true)
    let cancelled = false
    fetch(`/api/work-logs?contractId=${encodeURIComponent(contract.id)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((logs: any[]) => {
        if (cancelled) return
        const cids: string[] = []
        for (const log of logs) {
          if (Array.isArray(log.photoHashes)) {
            for (const h of log.photoHashes) {
              if (typeof h === 'string' && h.length > 0 && !cids.includes(h)) cids.push(h)
            }
          }
        }
        setPhotoCids(cids)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPhotosLoading(false) })
    return () => { cancelled = true }
  }, [contract?.id])

  if (loading) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400 text-lg mb-2">{t('notFound')}</div>
          <Link href="/contracts" className="text-emerald-600 dark:text-emerald-400 text-sm hover:underline">{t('backToRegistry')}</Link>
        </div>
      </div>
    )
  }

  const daysLeft = getDaysUntilDeadline(contract.deadline)
  const completed = getMilestoneCompletedCount(contract)
  const total = contract.milestones.length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0
  const effectiveStatus: ContractStatus =
    contract.status === 'active' && total > 0 && completed === total ? 'completed' : contract.status
  const status = statusConfig[effectiveStatus]

  const signedLabel = contract.signedAt
    ? new Intl.DateTimeFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(contract.signedAt))
    : null

  const PHOTO_PLACEHOLDERS = [
    { label: t('photoStart'), date: '10.03.2026' },
    { label: t('photoMid'), date: '18.03.2026' },
    { label: t('photoCurrent'), date: '25.03.2026' },
  ]
  const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud'

  const onChainDaysLeft = onChainSnapshot ? getDaysUntilDeadline(onChainSnapshot.deadline) : null
  const jurorWallet =
    wallet.publicKey?.toBase58() || (user?.id && isSolanaAddress(user.id) ? user.id : null)

  const isContractorView =
    user?.role === 'CONTRACTOR' && ownsContract(user.id, contract.contractorId, contract.contractor, contract.contractorWalletAddress)

  const juryRejections =
    contract.jurySessions?.filter((s) => s.result === 'REJECT' || s.result === 'reject') ?? []

  const canPublishOnChain = !contract.onChainPubkey && !!wallet.publicKey

  const handlePublishOnChain = async () => {
    if (!contract || !wallet.publicKey) return
    setPublishLoading(true)
    setPublishError(null)
    try {
      const result = await registerContractOnChain(
        contract.title,
        contract.district,
        Number(contract.amount_usdc || 0),
        Math.floor(new Date(contract.deadline).getTime() / 1000),
        contract.milestones.map((m) => ({
          description: m.desc,
          deadlineDays: m.deadline_days,
          tranchePct: m.tranche_pct,
        })),
        Number(contract.lat),
        Number(contract.lng),
        wallet.publicKey
      )

      await fetch(`/api/contracts/${encodeURIComponent(contract.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ onChainPubkey: result.pda }),
      })
      await loadContract()
    } catch (err: any) {
      setPublishError(err?.message || t('onChainPublishError'))
    } finally {
      setPublishLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Back nav */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/contracts" className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            {t('registryTitle')}
          </Link>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <span className="text-gray-500 dark:text-gray-400 text-sm truncate">{contract.title}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header card */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border mb-3 ${status.color}`}>
                    {status.label}
                  </span>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{contract.title}</h1>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('contractor')}</div>
                  <div className="text-gray-900 dark:text-white text-sm font-medium">{contract.contractor}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('district')}</div>
                  <div className="text-gray-900 dark:text-white text-sm font-medium">{contract.district}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('amount')}</div>
                  <CryptoTooltip amount={contract.amount_usdc}>
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">{formatTengeWithCrypto(contract.amount_usdc)}</span>
                  </CryptoTooltip>
                </div>
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('deadline')}</div>
                  <div className={`text-sm font-medium ${
                    daysLeft < 0 ? 'text-red-500 dark:text-red-400' : daysLeft < 7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'
                  }`}>
                    {daysLeft < 0
                      ? t('overdueDays', { days: Math.abs(daysLeft) })
                      : t('daysLeft', { days: daysLeft })}
                  </div>
                </div>
              </div>

              {(contract.registryNumber || contract.customerName || contract.subjectType || signedLabel) && (
                <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('goszakupBlock')}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {contract.registryNumber && (
                      <div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{t('registryNumber')}</div>
                        <div className="font-mono text-gray-900 dark:text-white">{contract.registryNumber}</div>
                      </div>
                    )}
                    {contract.customerName && (
                      <div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{t('customer')}</div>
                        <div className="text-gray-900 dark:text-white">{contract.customerName}</div>
                      </div>
                    )}
                    {contract.subjectType && (
                      <div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{t('subjectType')}</div>
                        <div className="text-gray-900 dark:text-white">{contract.subjectType}</div>
                      </div>
                    )}
                    {signedLabel && (
                      <div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{t('signedAt')}</div>
                        <div className="text-gray-900 dark:text-white">{signedLabel}</div>
                      </div>
                    )}
                  </div>
                  <ExternalLink
                    href={GOSZAKUP_ALMATY_WORKS_MIN10M_URL}
                    label={t('goszakupOpen')}
                    withIcon
                    className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                  />
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('onChainStatusLabel')}</div>
                {contract.onChainPubkey ? (
                  <div className="space-y-3">
                    <OnChainLink
                      address={contract.onChainPubkey}
                      label={t('openOnChain')}
                      withIcon
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    />
                    {onChainSnapshot && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-gray-400 dark:text-gray-500">{t('onChainContractor')}</div>
                          <div className="font-mono text-gray-700 dark:text-gray-300">{shortAddress(onChainSnapshot.contractor)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 dark:text-gray-500">{t('onChainAmount')}</div>
                          <CryptoTooltip amount={onChainSnapshot.amount_usdc}>
                            <span className="text-gray-700 dark:text-gray-300">{formatTengeWithCrypto(onChainSnapshot.amount_usdc)}</span>
                          </CryptoTooltip>
                        </div>
                        <div>
                          <div className="text-gray-400 dark:text-gray-500">{t('onChainDeadline')}</div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {onChainDaysLeft != null
                              ? (onChainDaysLeft < 0
                                ? t('overdueDays', { days: Math.abs(onChainDaysLeft) })
                                : t('daysLeft', { days: onChainDaysLeft }))
                              : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 dark:text-gray-500">{t('onChainStatus')}</div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {statusConfig[onChainSnapshot.status]?.label || onChainSnapshot.status}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 dark:text-gray-500">{t('onChainEscrow')}</div>
                          <CryptoTooltip amount={onChainSnapshot.escrow_amount}>
                            <span className="text-gray-700 dark:text-gray-300">{formatTengeWithCrypto(onChainSnapshot.escrow_amount)}</span>
                          </CryptoTooltip>
                        </div>
                        <div>
                          <div className="text-gray-400 dark:text-gray-500">{t('onChainMilestones')}</div>
                          <div className="text-gray-700 dark:text-gray-300">{onChainSnapshot.milestones.length}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('onChainMissing')}</div>
                    {canPublishOnChain && (
                      <button
                        type="button"
                        onClick={() => void handlePublishOnChain()}
                        disabled={publishLoading}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 disabled:opacity-60"
                      >
                        {publishLoading ? t('onChainPublishLoading') : t('onChainPublish')}
                      </button>
                    )}
                    {!wallet.publicKey && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">{t('onChainConnectWallet')}</div>
                    )}
                    {publishError && (
                      <div className="text-xs text-red-500 dark:text-red-400">{publishError}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Progress */}
              <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500 dark:text-gray-400">{t('overallProgress')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{completed}/{total} {t('milestones')} • {progressPct}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {isContractorView && (
              <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-6 space-y-5">
                <h2 className="text-gray-900 dark:text-white font-semibold">{t('contractorPanelTitle')}</h2>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('juryFeedbackTitle')}</h3>
                  {juryRejections.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('noJuryFeedback')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {juryRejections.map((s) => {
                        const ms = contract.milestones.find((m) => m.id === s.milestoneId)
                        const label = s.milestoneDescription || ms?.desc || s.milestoneId
                        return (
                          <li
                            key={s.id}
                            className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2"
                          >
                            {t('juryRejectLine', { milestone: label })}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('penaltyCountdownTitle')}</h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {t('daysUntilDeadlineLabel')}:{' '}
                    <span className={daysLeft < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'font-semibold'}>
                      {daysLeft}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {t('penaltyAccrued', { count: contract.penalties?.length ?? 0 })}
                  </p>
                  {(contract.penalties?.length ?? 0) > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      {contract.penalties!.slice(0, 5).map((p) => (
                        <li key={p.id}>
                          {t('penaltyLine', {
                            type: p.type,
                            amount: new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ').format(p.amountTenge),
                          })}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('contractorActions')}</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkLogModalOpen(true)}
                      className="inline-flex px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
                    >
                      {t('addReport')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMilestoneModalOpen(true)}
                      className="inline-flex px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
                    >
                      {t('submitMilestone')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Milestone tracker */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h2 className="text-gray-900 dark:text-white font-semibold mb-5 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {t('executionStages')}
              </h2>
              <MilestoneTracker
                milestones={contract.milestones}
                contractId={contract.id}
                showCitizenJuryVote={showCitizenJuryVote}
                jurySessions={contract.jurySessions}
                jurorWallet={jurorWallet}
              />
            </div>

            {/* Photo evidence */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h2 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('photoEvidence')}
              </h2>
              {photosLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : photoCids.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photoCids.map((cid) => (
                      <a
                        key={cid}
                        href={`${PINATA_GATEWAY}/ipfs/${cid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-video rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-all group relative"
                      >
                        <img
                          src={`${PINATA_GATEWAY}/ipfs/${cid}`}
                          alt="Evidence"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                          <span className="text-[10px] text-white/80 font-mono">{cid.slice(0, 12)}…</span>
                        </div>
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t('photoIpfs')}</p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {PHOTO_PLACEHOLDERS.map((photo, i) => (
                      <div
                        key={i}
                        className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-2"
                      >
                        <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="text-center px-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400">{photo.label}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{photo.date}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t('photoIpfs')}</p>
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Penalty calculator */}
            <PenaltyCalculator contract={contract} />

            {/* Contract meta */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h3 className="text-gray-900 dark:text-white font-semibold mb-4">{t('metadata')}</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: t('contractId'), value: <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">#{contract.id.slice(0, 8)}</span> },
                  { label: t('coordinates'), value: <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{contract.lat}, {contract.lng}</span> },
                  { label: t('escrow20'), value: <CryptoTooltip amount={contract.escrow_amount}><span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{formatTengeWithCrypto(contract.escrow_amount)}</span></CryptoTooltip> },
                  { label: t('status'), value: <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{statusConfig[effectiveStatus].label}</span> },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-gray-400 dark:text-gray-500">{item.label}</span>
                    {item.value}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isContractorView && contract.contractorId && (
        <>
          <WorkLogFormModal
            open={workLogModalOpen}
            onClose={() => setWorkLogModalOpen(false)}
            contracts={[{ id: contract.id, title: contract.title }]}
            authHeader={authHeader}
            onSuccess={() => void loadContract()}
          />
          <MilestoneSubmitModal
            open={milestoneModalOpen}
            onClose={() => setMilestoneModalOpen(false)}
            contracts={[
              {
                id: contract.id,
                title: contract.title,
                onChainPubkey: contract.onChainPubkey,
                milestones: contract.milestones.map((m) => ({
                  id: m.id,
                  description: m.desc,
                  sortOrder: m.sortOrder ?? 0,
                  status: milestoneStatusForApi(m),
                })),
              },
            ]}
            contractorWalletAddress={contract.contractorWalletAddress}
            authHeader={authHeader}
            onSuccess={() => void loadContract()}
          />
        </>
      )}
    </div>
  )
}
