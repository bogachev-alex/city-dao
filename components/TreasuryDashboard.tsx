'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useWallet } from '@solana/wallet-adapter-react'
import ProposalResearch from './ProposalResearch'
import { useDistrictTreasury } from '@/lib/web3/useDistrictTreasury'

interface Vote {
  id: string
  citizenId: string
  inFavor: boolean
}

interface Proposal {
  id: string
  title: string
  description: string
  amount: string
  votesFor: number
  votesAgainst: number
  category: string | null
  status: string
  votingEnds: string | null
  votes?: Vote[]
}

interface TreasuryData {
  id: string
  district: string
  balance: string
  proposals: Proposal[]
}

interface TreasuryDashboardProps {
  district: string
}

export default function TreasuryDashboard({ district }: TreasuryDashboardProps) {
  const t = useTranslations('components.treasuryDashboard')
  const { connected: walletConnected } = useWallet()
  const { voteOnProposal: voteOnChain, loading: solanaLoading } = useDistrictTreasury()
  const [treasury, setTreasury] = useState<TreasuryData | null>(null)
  const [citizenId, setCitizenId] = useState<string | null>(null)
  const [voted, setVoted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [txInfo, setTxInfo] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/treasury/${encodeURIComponent(district)}`).then((r) => r.json()),
      fetch('/api/citizens').then((r) => r.json()),
    ])
      .then(([treasuryData, citizens]) => {
        if (!treasuryData.error) setTreasury(treasuryData)
        let cid: string | null = null
        if (Array.isArray(citizens) && citizens.length > 0) {
          const local = citizens.find((c: any) => c.district === district)
          cid = local?.id || citizens[0].id
          setCitizenId(cid)
        }
        if (!treasuryData.error && cid) {
          const alreadyVoted = new Set<string>()
          for (const p of treasuryData.proposals || []) {
            if (p.votes?.some((v: Vote) => v.citizenId === cid)) {
              alreadyVoted.add(p.id)
            }
          }
          setVoted(alreadyVoted)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [district])

  const handleVote = async (proposalId: string, proposalTitle: string, inFavor: boolean) => {
    if (voted.has(proposalId) || !citizenId) return

    setVoted((prev) => new Set(prev).add(proposalId))
    setTreasury((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        proposals: prev.proposals.map((p) =>
          p.id === proposalId
            ? { ...p, votesFor: inFavor ? p.votesFor + 1 : p.votesFor, votesAgainst: !inFavor ? p.votesAgainst + 1 : p.votesAgainst }
            : p
        ),
      }
    })

    if (walletConnected) {
      try {
        const result = await voteOnChain(district, proposalTitle, inFavor)
        setTxInfo(result.tx)
      } catch (err: any) {
        console.log('On-chain vote failed (continuing with DB):', err.message)
      }
    }

    try {
      const res = await fetch(`/api/treasury/${encodeURIComponent(district)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, citizenId, inFavor }),
      })
      if (!res.ok) {
        revertVote(proposalId, inFavor)
      }
    } catch {
      revertVote(proposalId, inFavor)
    }
  }

  const revertVote = (proposalId: string, inFavor: boolean) => {
    setVoted((prev) => { const next = new Set(prev); next.delete(proposalId); return next })
    setTreasury((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        proposals: prev.proposals.map((p) =>
          p.id === proposalId
            ? { ...p, votesFor: inFavor ? p.votesFor - 1 : p.votesFor, votesAgainst: !inFavor ? p.votesAgainst - 1 : p.votesAgainst }
            : p
        ),
      }
    })
  }

  const formatTenge = (n: number | string) => new Intl.NumberFormat('ru-KZ').format(Number(n)) + ' ₸'

  const balance = treasury ? Number(treasury.balance) : 0
  const proposals = treasury?.proposals || []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-500/20 dark:to-emerald-600/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-6">
          <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">{t('treasuryBalance')}</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{formatTenge(balance)}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{district}</div>
          <div className="mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('liveBalance')}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('proposals')}</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{proposals.length}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('activeVotings')}</div>
          <div className="mt-3">
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: proposals.length > 0 ? '100%' : '0%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* On-chain tx notification */}
      {txInfo && (
        <div className="bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3 flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-emerald-600 dark:text-emerald-400">{t('voteRecorded')}</span>
          {txInfo && (
            <a href={`https://explorer.solana.com/tx/${txInfo}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 text-xs underline ml-auto">
              tx
            </a>
          )}
        </div>
      )}

      {/* Proposals */}
      <div>
        <h3 className="text-gray-900 dark:text-white font-semibold mb-3 flex items-center gap-2">
          <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {t('spendingProposals')}
        </h3>
        {proposals.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
            {t('noActiveProposals')}
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((proposal) => {
              const total = proposal.votesFor + proposal.votesAgainst
              const forPct = total > 0 ? Math.round((proposal.votesFor / total) * 100) : 50
              const hasVoted = voted.has(proposal.id)

              return (
                <div key={proposal.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {proposal.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
                            {proposal.category}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          proposal.status === 'VOTING' ? 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                          proposal.status === 'EXECUTED' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                          'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          {proposal.status === 'VOTING' ? t('voting') :
                           proposal.status === 'EXECUTED' ? t('executed') :
                           proposal.status}
                        </span>
                      </div>
                      <h4 className="text-gray-900 dark:text-white font-medium">{proposal.title}</h4>
                      <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">{formatTenge(proposal.amount)}</div>
                      {proposal.description && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{proposal.description}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      <ProposalResearch proposal={{ id: Number(proposal.id), title: proposal.title, amount: Number(proposal.amount), category: proposal.category || '', district }} />
                      {proposal.status === 'VOTING' && !hasVoted ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleVote(proposal.id, proposal.title, true)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition-colors"
                          >
                            {t('for')}
                          </button>
                          <button
                            onClick={() => handleVote(proposal.id, proposal.title, false)}
                            className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                          >
                            {t('against')}
                          </button>
                        </div>
                      ) : hasVoted ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 px-2 py-1 rounded-lg">
                          {t('voted')}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                      <span>{t('for')}: {proposal.votesFor}</span>
                      <span>{forPct}%</span>
                      <span>{t('against')}: {proposal.votesAgainst}</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${forPct}%` }} />
                      <div className="h-full bg-red-400 flex-1 transition-all duration-500" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
