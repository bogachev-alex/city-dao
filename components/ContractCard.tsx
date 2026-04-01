'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import {
  Contract,
  getDaysUntilDeadline,
  getMilestoneCompletedCount,
  formatTengeWithCrypto,
  getContractDetailHref,
} from '@/lib/contracts'
import OnChainLink from '@/components/OnChainLink'

interface ContractCardProps {
  contract: Contract
}

export default function ContractCard({ contract }: ContractCardProps) {
  const t = useTranslations('components.contractCard')
  const daysLeft = getDaysUntilDeadline(contract.deadline)
  const completed = getMilestoneCompletedCount(contract)
  const total = contract.milestones.length
  const progressPct = Math.round((completed / total) * 100)

  const statusConfig = {
    active: { label: t('active'), color: 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' },
    penalized: { label: t('penalized'), color: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' },
    completed: { label: t('completed'), color: 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' },
    disputed: { label: t('disputed'), color: 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30' },
  }

  const status = statusConfig[contract.status]

  const deadlineColor =
    daysLeft < 0 ? 'text-red-500 dark:text-red-400' : daysLeft < 7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'
  const contractHref = getContractDetailHref(contract.id, contract.onChainPubkey)

  return (
    <div className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:shadow-md dark:hover:shadow-lg transition-all duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <Link href={contractHref} className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug group-hover:text-emerald-600 dark:text-emerald-400 transition-colors line-clamp-2">
              {contract.title}
            </h3>
          </Link>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
            {status.label}
          </span>
        </div>

        {(contract.registryNumber || contract.subjectType) && (
          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-500 dark:text-gray-400">
            {contract.registryNumber && (
              <span className="font-mono text-gray-600 dark:text-gray-300">
                {t('registry')} {contract.registryNumber}
              </span>
            )}
            {contract.subjectType && (
              <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {contract.subjectType}
              </span>
            )}
          </div>
        )}

        {contract.customerName && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
            <span className="text-gray-400 dark:text-gray-500">{t('customer')}: </span>
            {contract.customerName}
          </div>
        )}

        {/* Contractor & district */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {contract.contractor}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {contract.district}
          </span>
        </div>

        {/* Amount */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{t('contractAmount')}</div>
            <div className="text-gray-900 dark:text-white font-semibold">{formatTengeWithCrypto(contract.amount_usdc)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{t('deadline')}</div>
            <div className={`font-medium text-sm ${deadlineColor}`}>
              {daysLeft < 0 ? t('overdueBy', { days: Math.abs(daysLeft) }) : t('daysLeft', { days: daysLeft })}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-1.5">
            <span>{t('stageProgress')}</span>
            <span>{completed}/{total} {t('done')}</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                contract.status === 'penalized' ? 'bg-red-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Penalty */}
        {contract.penalty_amount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2">
            <svg width="14" height="14" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs text-red-600 dark:text-red-400 font-medium animate-pulse">
              {t('penaltyLabel')} {formatTengeWithCrypto(contract.penalty_amount)}
            </span>
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
          <Link
            href={contractHref}
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {t('openContract')}
          </Link>
          <OnChainLink
            address={contract.onChainPubkey}
            label={t('onChain')}
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          />
        </div>
      </div>
  )
}
