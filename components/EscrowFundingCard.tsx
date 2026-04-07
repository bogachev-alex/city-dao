'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { useContractRegistry } from '@/lib/web3/useContractRegistry'
import { getSolanaExplorerTxUrl } from '@/lib/contracts'
import { getEscrowPDA } from '@/lib/web3/pda'
import type { Contract, Milestone } from '@/lib/contracts'

interface Props {
  contract: Contract
  onChainPubkey: string | null
  onPayoutSuccess?: () => void
}

export default function EscrowFundingCard({ contract, onChainPubkey, onPayoutSuccess }: Props) {
  const t = useTranslations('contractDetail')
  const wallet = useWallet()
  const {
    fundEscrow,
    getEscrowBalance,
    acceptMilestone,
    loading: registryLoading,
  } = useContractRegistry()

  const [escrowSol, setEscrowSol] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [fundTxHash, setFundTxHash] = useState<string | null>(null)
  const [fundError, setFundError] = useState<string | null>(null)
  const [payoutTxHash, setPayoutTxHash] = useState<string | null>(null)
  const [payoutError, setPayoutError] = useState<string | null>(null)
  const [payoutMilestoneId, setPayoutMilestoneId] = useState<string | null>(null)

  // Total required in SOL (contract amount converted from tenge)
  const KZT_PER_SOL = 80_000
  const requiredSol = contract.amount_usdc / KZT_PER_SOL
  const fundedPct = escrowSol != null && requiredSol > 0
    ? Math.min(100, Math.round((escrowSol / requiredSol) * 100))
    : 0

  const refreshBalance = useCallback(async () => {
    if (!onChainPubkey) return
    setBalanceLoading(true)
    try {
      const contractPk = new PublicKey(onChainPubkey)
      const { sol } = await getEscrowBalance(contractPk)
      setEscrowSol(sol)
    } catch {
      setEscrowSol(null)
    } finally {
      setBalanceLoading(false)
    }
  }, [onChainPubkey, getEscrowBalance])

  useEffect(() => {
    void refreshBalance()
  }, [refreshBalance])

  const handleFund = async () => {
    if (!onChainPubkey || !wallet.publicKey) return
    const sol = parseFloat(fundAmount)
    if (isNaN(sol) || sol <= 0) return

    setFundError(null)
    setFundTxHash(null)

    try {
      const lamports = Math.round(sol * LAMPORTS_PER_SOL)
      const result = await fundEscrow(new PublicKey(onChainPubkey), lamports)
      setFundTxHash(result.tx)
      setFundAmount('')
      await refreshBalance()
    } catch (err: any) {
      setFundError(err?.message || t('escrowFundError'))
    }
  }

  const handlePayout = async (milestone: Milestone, milestoneIndex: number) => {
    if (!onChainPubkey || !wallet.publicKey || !contract.contractorWalletAddress) return

    setPayoutError(null)
    setPayoutTxHash(null)
    setPayoutMilestoneId(milestone.id)

    try {
      const contractPk = new PublicKey(onChainPubkey)
      const contractorPk = new PublicKey(contract.contractorWalletAddress)
      const result = await acceptMilestone(contractPk, contractorPk, milestoneIndex)
      setPayoutTxHash(result.tx)
      await refreshBalance()
      onPayoutSuccess?.()
    } catch (err: any) {
      setPayoutError(err?.message || t('escrowFundError'))
    } finally {
      setPayoutMilestoneId(null)
    }
  }

  // Milestones eligible for payout: accepted by jury (under_review) or ready to release
  const payableMilestones = contract.milestones
    .map((m, i) => ({ milestone: m, index: i }))
    .filter(({ milestone }) => milestone.status === 'under_review' || milestone.status === 'accepted')

  if (!onChainPubkey) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <h3 className="text-gray-900 dark:text-white font-semibold mb-3 flex items-center gap-2">
          <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('escrowBalance')}
        </h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('escrowNoContract')}</p>
      </div>
    )
  }

  const escrowPDA = getEscrowPDA(new PublicKey(onChainPubkey))[0].toBase58()

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
      {/* Header */}
      <h3 className="text-gray-900 dark:text-white font-semibold flex items-center gap-2">
        <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {t('escrowBalance')}
      </h3>

      {/* Balance display */}
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-2xl font-bold text-emerald-500">
            {balanceLoading ? (
              <span className="inline-block w-5 h-5 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
            ) : escrowSol != null ? (
              `${escrowSol.toFixed(4)} SOL`
            ) : (
              '—'
            )}
          </span>
          <button
            type="button"
            onClick={() => void refreshBalance()}
            className="text-xs text-gray-400 hover:text-emerald-500 transition-colors"
            title="Refresh"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
            <span>{t('escrowFunded')}: {fundedPct}%</span>
            <span>{t('escrowRequired')}: {requiredSol.toFixed(2)} SOL</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                fundedPct >= 100
                  ? 'bg-emerald-500'
                  : fundedPct >= 50
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
              }`}
              style={{ width: `${fundedPct}%` }}
            />
          </div>
        </div>

        {/* Escrow PDA address */}
        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate" title={escrowPDA}>
          Escrow: {escrowPDA.slice(0, 8)}...{escrowPDA.slice(-6)}
        </div>
      </div>

      {/* Fund form */}
      {wallet.publicKey ? (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('escrowFundAction')}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              placeholder={t('escrowFundPlaceholder')}
              className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => void handleFund()}
              disabled={registryLoading || !fundAmount}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {registryLoading ? t('escrowFundLoading') : t('escrowFundSubmit')}
            </button>
          </div>
          {fundTxHash && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400">
              {t('escrowFundSuccess', { tx: fundTxHash.slice(0, 12) + '...' })}{' '}
              <a
                href={getSolanaExplorerTxUrl(fundTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-emerald-500"
              >
                Explorer
              </a>
            </div>
          )}
          {fundError && (
            <div className="text-xs text-red-500 dark:text-red-400">{fundError}</div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-800">
          {t('escrowConnectWallet')}
        </div>
      )}

      {/* Payout section */}
      {payableMilestones.length > 0 && wallet.publicKey && contract.contractorWalletAddress && (
        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('escrowPayoutTitle')}
          </label>
          {payableMilestones.map(({ milestone, index }) => {
            const trancheSol = requiredSol * milestone.tranche_pct / 100
            const isProcessing = payoutMilestoneId === milestone.id
            return (
              <div
                key={milestone.id}
                className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 dark:text-white truncate">
                    {milestone.desc}
                  </div>
                  <div className="text-xs text-gray-400">
                    {trancheSol.toFixed(4)} SOL ({milestone.tranche_pct}%)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handlePayout(milestone, index)}
                  disabled={registryLoading || isProcessing}
                  className="shrink-0 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? t('escrowPayoutLoading') : t('escrowPayoutAction')}
                </button>
              </div>
            )
          })}
          {payoutTxHash && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400">
              {t('escrowPayoutSuccess', { tx: payoutTxHash.slice(0, 12) + '...' })}{' '}
              <a
                href={getSolanaExplorerTxUrl(payoutTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-emerald-500"
              >
                Explorer
              </a>
            </div>
          )}
          {payoutError && (
            <div className="text-xs text-red-500 dark:text-red-400">{payoutError}</div>
          )}
        </div>
      )}
    </div>
  )
}
