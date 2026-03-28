'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Contract, formatAmount } from '@/lib/contracts'

interface PenaltyCalculatorProps {
  contract: Contract
}

export default function PenaltyCalculator({ contract }: PenaltyCalculatorProps) {
  const t = useTranslations('components.penaltyCalculator')
  const [currentPenalty, setCurrentPenalty] = useState(contract.penalty_amount)
  const [tick, setTick] = useState(0)

  const isOverdue = contract.status === 'penalized' && (contract.days_overdue ?? 0) > 0
  const dailyPenalty = Math.round(contract.amount_usdc * 0.01) // 1% per day
  const penaltyPct = Math.round((currentPenalty / contract.escrow_amount) * 100)

  useEffect(() => {
    if (!isOverdue) return
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [isOverdue])

  useEffect(() => {
    if (!isOverdue) return
    setCurrentPenalty((prev) => Math.min(prev + dailyPenalty / (24 * 60 * 20), contract.escrow_amount))
  }, [tick, isOverdue, dailyPenalty, contract.escrow_amount])

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
        <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {t('title')}
      </h3>

      {/* Formula */}
      <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('formula')}</div>
        <div className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          <span className="text-yellow-600 dark:text-yellow-400">{t('overdueVar')}</span>
          <span className="text-gray-400 dark:text-gray-500"> × </span>
          <span className="text-blue-500 dark:text-blue-400">1%</span>
          <span className="text-gray-400 dark:text-gray-500"> × </span>
          <span className="text-emerald-500 dark:text-emerald-400">{t('amountVar')}</span>
          <span className="text-gray-400 dark:text-gray-500"> = </span>
          <span className="text-red-500 dark:text-red-400">{t('penaltyVar')}</span>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          {contract.days_overdue ?? 0} {t('days')} × 1% × {formatAmount(contract.amount_usdc)} = {formatAmount(Math.round((contract.days_overdue ?? 0) * 0.01 * contract.amount_usdc))} USDC
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('escrow20')}</div>
          <div className="text-gray-900 dark:text-white font-semibold">{formatAmount(contract.escrow_amount)}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{t('usdcFrozen')}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('dailyPenalty')}</div>
          <div className="text-yellow-600 dark:text-yellow-400 font-semibold">{formatAmount(dailyPenalty)}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{t('usdcPerDay')}</div>
        </div>
      </div>

      {/* Current penalty */}
      {contract.penalty_amount > 0 || isOverdue ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('currentPenalty')}</span>
            <span className={`font-bold text-lg ${isOverdue ? 'text-red-500 dark:text-red-400 animate-pulse' : 'text-red-500 dark:text-red-400'}`}>
              {formatAmount(Math.round(currentPenalty))} USDC
            </span>
          </div>

          {/* Escrow drain bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{t('escrowUsed')}</span>
              <span>{Math.min(penaltyPct, 100)}%</span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-red-500 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(penaltyPct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 dark:text-gray-500">{t('remaining')} {formatAmount(Math.max(0, Math.round(contract.escrow_amount - currentPenalty)))} USDC</span>
              <span className="text-red-500 dark:text-red-400">-{formatAmount(Math.round(currentPenalty))} USDC</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400 text-sm">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('noPenalties')}
        </div>
      )}
    </div>
  )
}
