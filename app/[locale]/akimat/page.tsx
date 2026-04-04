'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { useWallet } from '@solana/wallet-adapter-react'
import { useConnection } from '@solana/wallet-adapter-react'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useAuth } from '@/components/AuthContext'
import { formatTengeWithCrypto, getContractDetailHref } from '@/lib/contracts'
import { useContractRegistry } from '@/lib/web3/useContractRegistry'
import { tengeToLamports } from '@/lib/web3/constants'

type Overview = {
  totalContracts: number
  /** Аккаунты GovernmentContract в Solana (как в реестре при режиме on-chain). */
  contractsOnChain: number | null
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
  const { user, loading: authLoading, authHeader } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [blockers, setBlockers] = useState<
    Array<{
      id: string
      title: string
      createdAt: string
      description: string | null
      contract: { id: string; title: string; district: string }
      contractor: { id: string; name: string }
    }>
  >([])
  const [blockersDistrict, setBlockersDistrict] = useState<string>('')

  type CfQueueRow = {
    id: string
    title: string
    district: string
    totalAmount: string
    deadline: string
    lat: number
    lng: number
    onChainPubkey: string | null
    description: string | null
    milestones: { description: string; deadlineDays: number; tranchePct: number; sortOrder: number }[]
    contractor: { id: string; name: string }
    crowdfunding: {
      id: string
      title: string
      district: string
      status: string
      citizenRaised: string
      citizenTarget: string
      stateDeposited: boolean
    } | null
  }
  const [cfQueue, setCfQueue] = useState<CfQueueRow[]>([])
  const [cfContractors, setCfContractors] = useState<{ id: string; name: string; walletAddress: string | null }[]>([])
  const [cfLoading, setCfLoading] = useState(true)
  const [cfPick, setCfPick] = useState<Record<string, string>>({})
  const [cfBusyId, setCfBusyId] = useState<string | null>(null)
  const [cfMsg, setCfMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const wallet = useWallet()
  const { connection } = useConnection()
  const { registerContract: registerContractOnChain } = useContractRegistry()
  const pendingConnectRef = useRef(false)

  useEffect(() => {
    if (pendingConnectRef.current && wallet.wallet && !wallet.connected && !wallet.connecting) {
      pendingConnectRef.current = false
      wallet.connect().catch(() => {})
    }
  }, [wallet.wallet?.adapter.name, wallet.connected, wallet.connecting, wallet.connect])

  const handleConnectWallet = useCallback(() => {
    const isUsable = (s: WalletReadyState) => s === WalletReadyState.Installed || s === WalletReadyState.Loadable
    const phantom = wallet.wallets.find((w) => w.adapter.name === 'Phantom' && isUsable(w.readyState))
    const anyUsable = wallet.wallets.find((w) => isUsable(w.readyState))
    const target = phantom || anyUsable
    if (!target) {
      window.open('https://phantom.app/', '_blank')
      return
    }
    if (wallet.wallet?.adapter.name === target.adapter.name) {
      wallet.connect().catch(() => {})
      return
    }
    pendingConnectRef.current = true
    wallet.select(target.adapter.name)
  }, [wallet])

  const districtOptions = useMemo(() => {
    if (!data?.treasuries?.length) return ['Ауэзовский', 'Медеуский', 'Бостандыкский']
    return data.treasuries.map((t) => t.district)
  }, [data])

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

  useEffect(() => {
    if (!data?.treasuries?.length || blockersDistrict) return
    setBlockersDistrict(data.treasuries[0].district)
  }, [data, blockersDistrict])

  useEffect(() => {
    if (!user || user.role !== 'AKIMAT') return
    const d = blockersDistrict || data?.treasuries?.[0]?.district
    if (!d) return
    fetch(`/api/work-logs?type=BLOCKER&district=${encodeURIComponent(d)}`, {
      headers: { ...authHeader() },
    })
      .then(async (r) => (r.ok ? r.json() : []))
      .then((json) => setBlockers(Array.isArray(json) ? json : []))
      .catch(() => setBlockers([]))
  }, [user, blockersDistrict, data?.treasuries, authHeader])

  useEffect(() => {
    if (!user || user.role !== 'AKIMAT') return
    setCfLoading(true)
    setCfMsg(null)
    fetch('/api/akimat/crowdfunding-queue', { headers: { ...authHeader() } })
      .then(async (r) => {
        if (!r.ok) throw new Error('fail')
        return (await r.json()) as { queue: CfQueueRow[]; contractors: { id: string; name: string }[] }
      })
      .then((json) => {
        const q = Array.isArray(json.queue) ? json.queue : []
        setCfQueue(
          q.map((c: Record<string, unknown>) => ({
            id: String(c.id),
            title: String(c.title ?? ''),
            district: String(c.district ?? ''),
            totalAmount: String(c.totalAmount ?? '0'),
            deadline: c.deadline ? new Date(c.deadline as string).toISOString() : '',
            lat: Number(c.lat ?? 0),
            lng: Number(c.lng ?? 0),
            onChainPubkey: (c.onChainPubkey as string | null) ?? null,
            description: (c.description as string | null) ?? null,
            milestones: Array.isArray(c.milestones) ? c.milestones : [],
            contractor: c.contractor as CfQueueRow['contractor'],
            crowdfunding: (c.crowdfunding as CfQueueRow['crowdfunding']) ?? null,
          }))
        )
        setCfContractors(Array.isArray(json.contractors) ? json.contractors : [])
      })
      .catch(() => {
        setCfQueue([])
        setCfContractors([])
      })
      .finally(() => setCfLoading(false))
  }, [user, authHeader])

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
              <div className="text-xs text-gray-400 mt-1">{t('kpiContractsDb')}</div>
              {data.contractsOnChain != null && (
                <div className="text-xs text-emerald-300/80 mt-2 leading-snug">
                  {t('kpiContractsChain', { count: data.contractsOnChain })}
                </div>
              )}
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('crowdfundingQueueTitle')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-2xl">{t('crowdfundingQueueHint')}</p>
          <p className="text-xs text-amber-700/90 dark:text-amber-400/90 mb-3 max-w-2xl">{t('cfWalletHint')}</p>
          {!wallet.connected && (
            <button
              type="button"
              onClick={handleConnectWallet}
              className="mb-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              {t('cfConnectWalletLink')}
            </button>
          )}
          {cfMsg && (
            <div
              className={`mb-3 text-sm rounded-lg px-3 py-2 ${
                cfMsg.type === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              {cfMsg.text}
            </div>
          )}
          {cfLoading ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              …
            </div>
          ) : cfQueue.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              {t('crowdfundingQueueEmpty')}
            </div>
          ) : (
            <div className="space-y-3">
              {cfQueue.map((row) => (
                <div
                  key={row.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-end gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{row.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {row.district}
                      {row.crowdfunding && (
                        <>
                          {' · '}
                          {t('crowdfundingQueueStatus')}: {row.crowdfunding.status}
                        </>
                      )}
                    </div>
                    {row.crowdfunding && (
                      <Link
                        href={`/crowdfunding/${row.crowdfunding.id}`}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-2 inline-block"
                      >
                        {t('crowdfundingQueueCampaign')}: {row.crowdfunding.title}
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{t('selectContractor')}</span>
                      <select
                        value={cfPick[row.id] || ''}
                        onChange={(e) => setCfPick((p) => ({ ...p, [row.id]: e.target.value }))}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white min-w-[200px]"
                      >
                        <option value="">—</option>
                        {cfContractors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {!c.walletAddress ? ` (${t('cfNoWalletSuffix')})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={
                        !cfPick[row.id] ||
                        cfBusyId === row.id ||
                        (!row.onChainPubkey &&
                          (!wallet.connected ||
                            !cfContractors.find((x) => x.id === cfPick[row.id])?.walletAddress))
                      }
                      onClick={async () => {
                        const cid = cfPick[row.id]
                        if (!cid) return
                        const picked = cfContractors.find((x) => x.id === cid)
                        if (!picked?.walletAddress && !row.onChainPubkey) {
                          setCfMsg({ type: 'err', text: t('cfNoContractorWallet') })
                          return
                        }

                        setCfBusyId(row.id)
                        setCfMsg(null)
                        let pda = row.onChainPubkey

                        try {
                          if (!pda) {
                            if (!wallet.publicKey) {
                              setCfMsg({ type: 'err', text: t('cfConnectWallet') })
                              return
                            }
                            if (!picked?.walletAddress) {
                              setCfMsg({ type: 'err', text: t('cfNoContractorWallet') })
                              return
                            }

                            try {
                              const minRent = 0.01 * LAMPORTS_PER_SOL
                              const bal0 = await connection.getBalance(wallet.publicKey)
                              if (bal0 < minRent && connection.rpcEndpoint.includes('devnet')) {
                                const sig = await connection.requestAirdrop(
                                  wallet.publicKey,
                                  Math.floor(0.05 * LAMPORTS_PER_SOL)
                                )
                                await connection.confirmTransaction(sig, 'confirmed')
                              }
                            } catch {
                              /* ignore airdrop */
                            }

                            const fullLamports = tengeToLamports(Number(row.totalAmount))
                            const escrowLamports = Math.floor(fullLamports * 0.2)
                            const minBalance = escrowLamports + 10_000_000
                            const bal2 = await connection.getBalance(wallet.publicKey)
                            if (bal2 < minBalance) {
                              setCfMsg({
                                type: 'err',
                                text: t('cfInsufficientSol', {
                                  sol: (minBalance / LAMPORTS_PER_SOL).toFixed(4),
                                }),
                              })
                              return
                            }

                            if (!row.milestones?.length) {
                              setCfMsg({ type: 'err', text: t('cfNoMilestones') })
                              return
                            }

                            const deadlineSec = Math.floor(new Date(row.deadline).getTime() / 1000)
                            const contractorPk = new PublicKey(picked.walletAddress)
                            const reg = await registerContractOnChain(
                              row.title,
                              row.district,
                              fullLamports,
                              deadlineSec,
                              row.milestones.map((m) => ({
                                description: m.description,
                                deadlineDays: m.deadlineDays,
                                tranchePct: m.tranchePct,
                              })),
                              row.lat,
                              row.lng,
                              contractorPk
                            )
                            if (!reg?.pda) {
                              setCfMsg({ type: 'err', text: t('cfNoPda') })
                              return
                            }
                            pda = reg.pda
                          }

                          const res = await fetch(`/api/contracts/${row.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', ...authHeader() },
                            body: JSON.stringify({
                              contractorId: cid,
                              ...(pda ? { onChainPubkey: pda } : {}),
                            }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok) {
                            setCfMsg({ type: 'err', text: (data as { error?: string }).error || t('assignError') })
                            return
                          }
                          setCfMsg({
                            type: 'ok',
                            text: row.onChainPubkey ? t('assignSuccess') : t('cfAssignAndChainSuccess'),
                          })
                          setCfQueue((q) => q.filter((x) => x.id !== row.id))
                          setCfPick((p) => {
                            const next = { ...p }
                            delete next[row.id]
                            return next
                          })
                        } catch (e) {
                          setCfMsg({
                            type: 'err',
                            text: e instanceof Error ? e.message : t('assignError'),
                          })
                        } finally {
                          setCfBusyId(null)
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cfBusyId === row.id ? '…' : t('assignAndRegister')}
                    </button>
                    <Link
                      href={getContractDetailHref(row.id)}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 py-2"
                    >
                      {t('openContract')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('blockersTitle')}</h2>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('blockersDistrict')}</span>
              <select
                value={blockersDistrict || districtOptions[0] || ''}
                onChange={(e) => setBlockersDistrict(e.target.value)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              >
                {districtOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('blockersHint')}</p>
          {blockers.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              {t('blockersEmpty')}
            </div>
          ) : (
            <div className="space-y-2">
              {blockers.map((b) => (
                <div
                  key={b.id}
                  className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900/40 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{b.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {b.contract.title} · {b.contract.district} · {b.contractor.name}
                    </div>
                    {b.description && (
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{b.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(b.createdAt).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                    <Link href={getContractDetailHref(b.contract.id)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                      {t('openContract')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    <Link href={getContractDetailHref(c.id)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
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
