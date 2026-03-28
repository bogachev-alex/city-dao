'use client'

import { useState } from 'react'

interface ResearchReport {
  swot: {
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    threats: string[]
  }
  cost_analysis: {
    proposed: number
    market_average: number
    deviation_pct: number
    cost_per_unit: string
    verdict: 'reasonable' | 'inflated' | 'underfunded'
    verdict_ru: string
  }
  similar_projects: {
    city: string
    country: string
    year: number
    budget_usd: number
    outcome: 'success' | 'partial' | 'failed'
    lessons: string
  }[]
  risk_score: number
  recommendation: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK'
  recommendation_ru: string
  key_concerns: string[]
  key_positives: string[]
  sources_used: string[]
}

interface Props {
  proposal: {
    id: number
    title: string
    amount: number
    category: string
    district?: string
  }
}

const outcomeIcon = (o: string) =>
  o === 'success' ? '✅' : o === 'partial' ? '⚠️' : '❌'

const verdictColor = (v: string) =>
  v === 'reasonable' ? 'text-emerald-400' : v === 'inflated' ? 'text-red-400' : 'text-yellow-400'

const riskColor = (score: number) =>
  score < 30 ? '#10b981' : score < 60 ? '#f59e0b' : '#ef4444'

const riskLabel = (rec: string) =>
  rec === 'LOW_RISK' ? 'Низкий риск' : rec === 'MEDIUM_RISK' ? 'Средний риск' : 'Высокий риск'

export default function ProposalResearch({ proposal }: Props) {
  const [report, setReport] = useState<ResearchReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runResearch = async () => {
    setLoading(true)
    setError(null)
    setOpen(true)
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'Ошибка сервера')
      }
      const data = await res.json()
      setReport(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={runResearch}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-medium hover:bg-purple-500/30 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
        </svg>
        AI Анализ
      </button>

      {/* Slide-in panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div
            className="relative h-full w-full max-w-2xl bg-gray-950 border-l border-gray-800 overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-6 py-4 flex items-start justify-between gap-4 z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  </div>
                  <span className="text-xs text-purple-400 font-medium uppercase tracking-wider">AI Research Agent</span>
                </div>
                <h2 className="text-white font-semibold text-sm leading-snug">{proposal.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{new Intl.NumberFormat('ru-KZ').format(proposal.amount)} ₸ · {proposal.category}</p>
              </div>
              <button onClick={() => setOpen(false)} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Loading */}
              {loading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    Агент исследует проект в интернете...
                  </div>
                  {['Проверка рыночных цен...', 'Поиск аналогичных проектов...', 'Анализ рисков...', 'Формирование SWOT...'].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs text-gray-600 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                      {step}
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Report */}
              {report && !loading && (
                <>
                  {/* Risk meter */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-400 font-medium">Индекс риска</span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium border"
                        style={{
                          color: riskColor(report.risk_score),
                          borderColor: riskColor(report.risk_score) + '50',
                          backgroundColor: riskColor(report.risk_score) + '15',
                        }}>
                        {riskLabel(report.recommendation)}
                      </span>
                    </div>
                    <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${report.risk_score}%`,
                          backgroundColor: riskColor(report.risk_score),
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>0 — Минимальный</span>
                      <span className="font-bold" style={{ color: riskColor(report.risk_score) }}>{report.risk_score}/100</span>
                      <span>100 — Максимальный</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 leading-relaxed">{report.recommendation_ru}</p>
                  </div>

                  {/* Cost analysis */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                      <span className="text-base">💰</span> Анализ бюджета
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-gray-800/60 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Предложено</div>
                        <div className="text-white font-bold text-sm">{new Intl.NumberFormat('ru-KZ').format(report.cost_analysis.proposed)} ₸</div>
                      </div>
                      <div className="bg-gray-800/60 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Среднее по рынку</div>
                        <div className="text-white font-bold text-sm">{new Intl.NumberFormat('ru-KZ').format(report.cost_analysis.market_average)} ₸</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">{report.cost_analysis.cost_per_unit}</div>
                      <div className={`text-sm font-bold ${verdictColor(report.cost_analysis.verdict)}`}>
                        {report.cost_analysis.deviation_pct > 0 ? '+' : ''}{report.cost_analysis.deviation_pct}% · {report.cost_analysis.verdict_ru}
                      </div>
                    </div>
                  </div>

                  {/* SWOT */}
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                      <span className="text-base">🔍</span> SWOT-анализ
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'strengths', label: 'Сильные стороны', color: 'emerald', icon: '✅' },
                        { key: 'weaknesses', label: 'Слабые стороны', color: 'red', icon: '⚠️' },
                        { key: 'opportunities', label: 'Возможности', color: 'blue', icon: '🚀' },
                        { key: 'threats', label: 'Угрозы', color: 'yellow', icon: '🛡️' },
                      ].map(({ key, label, color, icon }) => (
                        <div key={key} className={`bg-${color}-500/5 border border-${color}-500/20 rounded-xl p-4`}>
                          <div className={`text-xs font-semibold text-${color}-400 mb-2 flex items-center gap-1`}>
                            <span>{icon}</span> {label}
                          </div>
                          <ul className="space-y-1.5">
                            {(report.swot as any)[key].map((item: string, i: number) => (
                              <li key={i} className="text-xs text-gray-400 leading-relaxed flex gap-2">
                                <span className="shrink-0 mt-0.5 text-gray-600">·</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Similar projects */}
                  {report.similar_projects?.length > 0 && (
                    <div>
                      <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                        <span className="text-base">🌍</span> Аналогичные проекты в мире
                      </h3>
                      <div className="space-y-2">
                        {report.similar_projects.map((p, i) => (
                          <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-start gap-3">
                            <span className="text-base shrink-0">{outcomeIcon(p.outcome)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-white text-xs font-medium">{p.city}, {p.country}</span>
                                <span className="text-gray-600 text-xs">{p.year}</span>
                                <span className="text-gray-500 text-xs">${new Intl.NumberFormat('en').format(p.budget_usd)}</span>
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed">{p.lessons}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key concerns / positives */}
                  <div className="grid grid-cols-1 gap-3">
                    {report.key_positives?.length > 0 && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                        <div className="text-xs font-semibold text-emerald-400 mb-2">Почему стоит поддержать</div>
                        <ul className="space-y-1">
                          {report.key_positives.map((p, i) => (
                            <li key={i} className="text-xs text-gray-400 flex gap-2"><span className="text-emerald-500 shrink-0">+</span>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {report.key_concerns?.length > 0 && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                        <div className="text-xs font-semibold text-red-400 mb-2">На что обратить внимание</div>
                        <ul className="space-y-1">
                          {report.key_concerns.map((c, i) => (
                            <li key={i} className="text-xs text-gray-400 flex gap-2"><span className="text-red-500 shrink-0">!</span>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Sources */}
                  {report.sources_used?.length > 0 && (
                    <div className="border-t border-gray-800 pt-4">
                      <div className="text-xs text-gray-600 mb-2">Источники</div>
                      <div className="flex flex-wrap gap-2">
                        {report.sources_used.map((s, i) => (
                          <span key={i} className="text-xs bg-gray-900 border border-gray-800 rounded px-2 py-1 text-gray-500">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
