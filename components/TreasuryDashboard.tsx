'use client'

import { useState } from 'react'
import ProposalResearch from './ProposalResearch'

interface Proposal {
  id: number
  title: string
  amount: number
  votesFor: number
  votesAgainst: number
  category: string
}

const INITIAL_PROPOSALS: Proposal[] = [
  {
    id: 1,
    title: 'Детская площадка на ул. Абая',
    amount: 500000,
    votesFor: 234,
    votesAgainst: 12,
    category: 'Благоустройство',
  },
  {
    id: 2,
    title: 'Озеленение парка Горького',
    amount: 1200000,
    votesFor: 89,
    votesAgainst: 45,
    category: 'Экология',
  },
  {
    id: 3,
    title: 'Ремонт дорожных знаков',
    amount: 150000,
    votesFor: 67,
    votesAgainst: 8,
    category: 'Безопасность',
  },
]

const TRANSACTIONS = [
  { id: 1, type: 'in', desc: 'Штраф ТОО АлматыДорСтрой', amount: 6000, date: '27.03.2026', usdc: true },
  { id: 2, type: 'out', desc: 'Транш этап 1 — ТОО СтройАлматы', amount: 11250, date: '24.03.2026', usdc: true },
  { id: 3, type: 'in', desc: 'Взносы граждан — март', amount: 890000, date: '01.03.2026', usdc: false },
  { id: 4, type: 'out', desc: 'Ремонт тротуаров (завершён)', amount: 3200000, date: '15.02.2026', usdc: false },
]

interface TreasuryDashboardProps {
  district: string
}

export default function TreasuryDashboard({ district }: TreasuryDashboardProps) {
  const [proposals, setProposals] = useState(INITIAL_PROPOSALS)
  const [voted, setVoted] = useState<Set<number>>(new Set())

  const balance = 12_450_000 // tenge
  const usdcBalance = 45_200

  const handleVote = (id: number, type: 'for' | 'against') => {
    if (voted.has(id)) return
    setProposals((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, votesFor: type === 'for' ? p.votesFor + 1 : p.votesFor, votesAgainst: type === 'against' ? p.votesAgainst + 1 : p.votesAgainst }
          : p
      )
    )
    setVoted((prev) => new Set(prev).add(id))
  }

  const formatTenge = (n: number) => new Intl.NumberFormat('ru-KZ').format(n) + ' ₸'

  return (
    <div className="space-y-6">
      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-6">
          <div className="text-sm text-emerald-400/80 mb-1">Баланс казны района</div>
          <div className="text-3xl font-bold text-white mb-1">{formatTenge(balance)}</div>
          <div className="text-sm text-gray-500">{district}</div>
          <div className="mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-400">Live баланс on-chain</span>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-sm text-gray-500 mb-1">Эскроу USDC</div>
          <div className="text-2xl font-bold text-emerald-400">{new Intl.NumberFormat('ru-KZ').format(usdcBalance)}</div>
          <div className="text-xs text-gray-600 mt-1">USD Coin (Solana)</div>
          <div className="mt-3">
            <div className="h-1.5 bg-gray-800 rounded-full">
              <div className="h-full w-3/4 bg-emerald-500 rounded-full" />
            </div>
            <div className="text-xs text-gray-600 mt-1">75% заблокировано</div>
          </div>
        </div>
      </div>

      {/* Proposals */}
      <div>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Предложения по расходам
        </h3>
        <div className="space-y-3">
          {proposals.map((proposal) => {
            const total = proposal.votesFor + proposal.votesAgainst
            const forPct = Math.round((proposal.votesFor / total) * 100)
            const hasVoted = voted.has(proposal.id)

            return (
              <div key={proposal.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {proposal.category}
                      </span>
                    </div>
                    <h4 className="text-white font-medium">{proposal.title}</h4>
                    <div className="text-sm text-emerald-400 mt-0.5">{formatTenge(proposal.amount)}</div>
                  </div>
                  <div className="flex flex-col gap-2 items-end shrink-0">
                    <ProposalResearch proposal={{ ...proposal, district }} />
                    {!hasVoted ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVote(proposal.id, 'for')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                        >
                          За
                        </button>
                        <button
                          onClick={() => handleVote(proposal.id, 'against')}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition-colors"
                        >
                          Против
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                        Проголосовано
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>За: {proposal.votesFor}</span>
                    <span>{forPct}%</span>
                    <span>Против: {proposal.votesAgainst}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${forPct}%` }} />
                    <div className="h-full bg-red-500 flex-1 transition-all duration-500" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          История транзакций
        </h3>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {TRANSACTIONS.map((tx, i) => (
            <div
              key={tx.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${i < TRANSACTIONS.length - 1 ? 'border-b border-gray-800' : ''} hover:bg-gray-800/50 transition-colors`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                tx.type === 'in' ? 'bg-emerald-500/20' : 'bg-red-500/20'
              }`}>
                <svg width="14" height="14" fill="none" stroke={tx.type === 'in' ? '#10b981' : '#f87171'} strokeWidth="2.5" viewBox="0 0 24 24">
                  {tx.type === 'in' ? (
                    <path d="M12 4v16m0 0l-4-4m4 4l4-4" />
                  ) : (
                    <path d="M12 20V4m0 0l4 4M12 4l-4 4" />
                  )}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{tx.desc}</div>
                <div className="text-xs text-gray-500">{tx.date}</div>
              </div>
              <div className={`text-sm font-semibold shrink-0 ${tx.type === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                {tx.type === 'in' ? '+' : '-'}
                {tx.usdc
                  ? `${new Intl.NumberFormat('ru-KZ').format(tx.amount)} USDC`
                  : formatTenge(tx.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
