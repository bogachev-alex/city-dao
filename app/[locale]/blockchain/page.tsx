'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import {
  FRONTEND_ONCHAIN_ACTIONS,
  OFF_CHAIN_FLOWS,
  PROGRAM_DEFINITIONS,
  getProgramIdBase58,
  getSolanaExplorerAddressUrl,
  getSolanaExplorerTxUrl,
  SOLANA_NETWORK,
  SOLANA_RPC_URL,
} from '@/lib/blockchainDashboardModel'
import TransactionFeed from '@/components/TransactionFeed'

const ROUTE_PATHS: Record<string, string> = {
  admin: '/admin',
  register: '/register',
  treasury: '/treasury/Ауэзовский',
  crowdfundingNew: '/crowdfunding/new',
  crowdfundingDetail: '/crowdfunding',
  contracts: '/contracts',
}

export default function BlockchainDashboardPage() {
  const t = useTranslations('blockchainDashboard')

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            {t('title')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl">{t('subtitle')}</p>
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-medium">
              {t('network')}: {SOLANA_NETWORK}
            </span>
            <a
              href={SOLANA_RPC_URL}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-mono text-xs break-all"
            >
              {SOLANA_RPC_URL}
            </a>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500">{t('explorerHint')}</p>
        </header>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('txFeedSectionTitle')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('txFeedSectionLead')}</p>
          <TransactionFeed maxItems={20} variant="embedded" showHeader={false} blockchainLink={false} />
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('programsTitle')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-3 pr-4 font-medium text-gray-700 dark:text-gray-300">{t('programColumn')}</th>
                  <th className="py-3 pr-4 font-medium text-gray-700 dark:text-gray-300">{t('programIdColumn')}</th>
                  <th className="py-3 pr-4 font-medium text-gray-700 dark:text-gray-300">{t('statusColumn')}</th>
                  <th className="py-3 font-medium text-gray-700 dark:text-gray-300">{t('instructionsColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {PROGRAM_DEFINITIONS.map((p) => {
                  const pk = getProgramIdBase58(p.key)
                  return (
                    <tr key={p.key} className="border-b border-gray-100 dark:border-gray-800 align-top">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-gray-900 dark:text-white">{t(`programs.${p.key}.name`)}</div>
                        <p className="mt-1 text-gray-500 dark:text-gray-400 text-xs max-w-xs">
                          {t(`programs.${p.key}.desc`)}
                        </p>
                      </td>
                      <td className="py-4 pr-4">
                        <a
                          href={getSolanaExplorerAddressUrl(pk)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-emerald-600 dark:text-emerald-400 break-all hover:underline"
                        >
                          {pk}
                        </a>
                      </td>
                      <td className="py-4 pr-4 whitespace-nowrap">
                        <span
                          className={
                            p.wiredInApp
                              ? 'inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          }
                        >
                          {p.wiredInApp ? t('wired') : t('plannedOnly')}
                        </span>
                      </td>
                      <td className="py-4">
                        <ul className="flex flex-wrap gap-1.5">
                          {p.instructions.map((name) => (
                            <li key={name}>
                              <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs">
                                {name}
                              </code>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('frontendTxTitle')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{t('frontendTxLead')}</p>
          <ul className="space-y-4">
            {FRONTEND_ONCHAIN_ACTIONS.map((action) => (
              <li
                key={action.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/80 dark:bg-gray-950/40"
              >
                <div className="flex flex-wrap items-baseline gap-2 mb-2">
                  <code className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{action.method}</code>
                  <span className="text-gray-400 text-xs">({action.hook})</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{t(`actions.${action.id}`)}</p>
                <div className="flex flex-wrap gap-2">
                  {action.routeKeys.map((rk) => {
                    const path = ROUTE_PATHS[rk]
                    if (!path) return null
                    return (
                      <Link
                        key={rk}
                        href={path as any}
                        className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        {t(`routes.${rk}`)} →
                      </Link>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('offChainTitle')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{t('offChainLead')}</p>
          <ul className="space-y-4">
            {OFF_CHAIN_FLOWS.map((flow) => (
              <li key={flow.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{t(`offChain.${flow.id}`)}</p>
                <div className="flex flex-wrap gap-2">
                  {flow.routeKeys.map((rk) => {
                    const path = ROUTE_PATHS[rk]
                    if (!path) return null
                    return (
                      <Link
                        key={rk}
                        href={path as any}
                        className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        {t(`routes.${rk}`)} →
                      </Link>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-900/30 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('explorerTitle')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('explorerBody')}</p>
          <code className="block text-xs font-mono p-3 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 break-all">
            {getSolanaExplorerTxUrl('<signature>')}
          </code>
        </section>
      </div>
    </div>
  )
}
