'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useConnection } from '@solana/wallet-adapter-react'
import { Link } from '@/i18n/routing'
import {
  DEMO_TRANSACTIONS,
  TX_TYPE_META,
  getTxExplorerUrl,
  formatTxTime,
  truncateSig,
  type TxType,
} from '@/lib/demoTransactions'
import { useDataSource } from '@/lib/web3/useDataSource'
import { fetchParsedTransactions, type OnChainTx } from '@/lib/web3/fetchTransactions'

export interface TransactionFeedItem {
  signature: string
  type: TxType
  description: string
  timestamp: string
  amount?: number
  contractId?: string
}

interface TransactionFeedProps {
  /** Filter by district (crowdfunding campaign or contract) */
  district?: string
  maxItems?: number
  /** floating = map overlay panel; embedded = block in page flow */
  variant?: 'floating' | 'embedded'
  className?: string
  /** Append demo txs when DB is short (default true) */
  includeDemo?: boolean
  blockchainLink?: boolean
  /** Show pulse + title row (disable when the page already has a section heading) */
  showHeader?: boolean
}

export default function TransactionFeed({
  district,
  maxItems = 12,
  variant = 'embedded',
  className = '',
  includeDemo = true,
  blockchainLink = true,
  showHeader = true,
}: TransactionFeedProps) {
  const t = useTranslations('components.transactionFeed')
  const dataSource = useDataSource()
  const { connection } = useConnection()
  const [items, setItems] = useState<TransactionFeedItem[]>([])
  const [demoAppended, setDemoAppended] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    // On-chain mode: fetch real Solana transactions
    if (dataSource === 'onchain') {
      fetchParsedTransactions(maxItems, connection)
        .then((txs: OnChainTx[]) => {
          if (txs.length > 0) {
            setItems(txs.map((tx) => ({
              signature: tx.signature,
              type: tx.type,
              description: tx.description,
              timestamp: tx.timestamp,
              amount: tx.amount,
            })))
            setDemoAppended(false)
          } else {
            // No on-chain txs yet, fall back to demo
            setItems(demoItems())
            setDemoAppended(true)
          }
        })
        .catch(() => {
          setItems(demoItems())
          setDemoAppended(true)
        })
        .finally(() => setLoading(false))
      return
    }

    // Mock mode: use API (DB + demo padding)
    const params = new URLSearchParams()
    params.set('limit', String(maxItems))
    if (district) params.set('district', district)
    if (!includeDemo) params.set('demo', '0')

    fetch(`/api/transactions?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { items?: TransactionFeedItem[]; demoAppended?: boolean }) => {
        const list = data.items
        if (Array.isArray(list) && list.length > 0) {
          setItems(list)
          setDemoAppended(!!data.demoAppended)
        } else {
          setItems(demoItems())
          setDemoAppended(true)
        }
      })
      .catch(() => {
        setItems(demoItems())
        setDemoAppended(true)
      })
      .finally(() => setLoading(false))

    function demoItems(): TransactionFeedItem[] {
      return DEMO_TRANSACTIONS.slice(0, maxItems).map((x) => ({
        signature: x.signature,
        type: x.type,
        description: x.description,
        timestamp: x.timestamp.toISOString(),
        amount: x.amount,
        contractId: x.contractId,
      }))
    }
  }, [district, maxItems, includeDemo, dataSource, connection])

  const inner = (
    <>
      {showHeader && (
        <div
          className={
            variant === 'floating'
              ? 'flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0'
              : 'flex items-center justify-between gap-2 mb-4 px-4 pt-4'
          }
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              {t('title')}
            </span>
          </div>
          {demoAppended && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 max-w-[140px] text-right leading-tight">
              {t('demoNote')}
            </span>
          )}
        </div>
      )}

      {!showHeader && demoAppended && variant === 'embedded' && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 px-4 pt-3">{t('demoNote')}</p>
      )}

      <div className={variant === 'floating' ? 'overflow-y-auto' : ''}>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-7 h-7 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('empty')}</div>
        ) : (
          items.map((tx) => {
            const meta = TX_TYPE_META[tx.type]
            const ts = new Date(tx.timestamp)
            return (
              <a
                key={tx.signature}
                href={getTxExplorerUrl(tx.signature)}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors group"
              >
                <span className="text-base mt-0.5 shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatTxTime(ts)}</span>
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 leading-snug">{tx.description}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-600 group-hover:text-emerald-500 transition-colors">
                      {truncateSig(tx.signature)}
                    </span>
                    <svg
                      className="w-2.5 h-2.5 text-gray-400 dark:text-gray-600 group-hover:text-emerald-500 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                  </div>
                </div>
              </a>
            )
          })
        )}
      </div>

      {blockchainLink && (
        <div
          className={
            variant === 'floating'
              ? 'px-4 py-2 border-t border-gray-200 dark:border-gray-800 shrink-0'
              : 'mt-2 pt-3 px-4 pb-4 border-t border-gray-200 dark:border-gray-800'
          }
        >
          <Link
            href="/blockchain"
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            {t('viewAll')}
          </Link>
        </div>
      )}
    </>
  )

  if (variant === 'floating') {
    return (
      <div
        className={`absolute top-4 right-4 z-[1000] w-72 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg flex flex-col max-h-[calc(100vh-8rem)] ${className}`}
      >
        {inner}
      </div>
    )
  }

  return (
    <div
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden ${className}`}
    >
      {inner}
    </div>
  )
}
