'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Contract, getContractById, getDaysUntilDeadline, getMilestoneCompletedCount, formatAmount, normalizeContract } from '@/lib/contracts'
import { fetchContract } from '@/lib/api'
import MilestoneTracker from '@/components/MilestoneTracker'
import PenaltyCalculator from '@/components/PenaltyCalculator'

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>()
  const t = useTranslations('contractDetail')
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)

  const statusConfig = {
    active: { label: t('statusActive'), color: 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' },
    penalized: { label: t('statusPenalized'), color: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' },
    completed: { label: t('statusCompleted'), color: 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' },
    disputed: { label: t('statusDisputed'), color: 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30' },
  }

  useEffect(() => {
    if (!params.id) return

    fetchContract(params.id)
      .then((data: any) => {
        if (data && !data.error) {
          setContract(normalizeContract(data))
        } else {
          const demo = getContractById(params.id)
          setContract(demo || null)
        }
      })
      .catch(() => {
        const demo = getContractById(params.id)
        setContract(demo || null)
      })
      .finally(() => setLoading(false))
  }, [params.id])

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
  const status = statusConfig[contract.status]

  const PHOTO_EVIDENCE = [
    { label: t('photoStart'), date: '10.03.2026' },
    { label: t('photoMid'), date: '18.03.2026' },
    { label: t('photoCurrent'), date: '25.03.2026' },
  ]

  const activeReviewMilestone = contract.milestones.find((m) => m.status === 'under_review')

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Back nav */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
                  <div className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">{formatAmount(contract.amount_usdc)} USDC</div>
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

            {/* Milestone tracker */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h2 className="text-gray-900 dark:text-white font-semibold mb-5 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {t('executionStages')}
              </h2>
              <MilestoneTracker milestones={contract.milestones} contractId={contract.id} />
            </div>

            {/* Photo evidence */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h2 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('photoEvidence')}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {PHOTO_EVIDENCE.map((photo, i) => (
                  <div
                    key={i}
                    className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-all group"
                  >
                    <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:stroke-emerald-500 transition-colors">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="text-center px-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-700">{photo.label}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{photo.date}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t('photoIpfs')}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Penalty calculator */}
            <PenaltyCalculator contract={contract} />

            {/* Jury status */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('jury')}
              </h3>
              {activeReviewMilestone ? (
                <div className="space-y-3">
                  <div className="bg-yellow-50 dark:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-300">
                    {t('activeReview')}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{t('voted')}</span>
                    <span className="text-gray-900 dark:text-white font-medium">7 / 9</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: '78%' }} />
                  </div>
                  <Link
                    href={`/jury/${contract.id}-${activeReviewMilestone.id}`}
                    className="block w-full text-center py-2.5 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition-colors"
                  >
                    {t('participateVoting')}
                  </Link>
                </div>
              ) : (
                <div className="text-sm text-gray-400 dark:text-gray-500">{t('noActiveSessions')}</div>
              )}
            </div>

            {/* Contract meta */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h3 className="text-gray-900 dark:text-white font-semibold mb-4">{t('metadata')}</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: t('contractId'), value: `#${contract.id.slice(0, 8)}` },
                  { label: t('coordinates'), value: `${contract.lat}, ${contract.lng}` },
                  { label: t('escrow20'), value: `${formatAmount(contract.escrow_amount)} USDC` },
                  { label: t('status'), value: statusConfig[contract.status].label },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500">{item.label}</span>
                    <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
