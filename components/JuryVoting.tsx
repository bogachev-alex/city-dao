'use client'

import { useEffect, useState } from 'react'
import { generateSalt, hashVoteCommitment } from '../lib/crypto'

interface JuryVotingProps {
  sessionId: string
}

type Phase = 'loading' | 'commit' | 'reveal' | 'results' | 'error'

interface JurySessionData {
  id: string
  status: string
  contract: { id: string; title: string; district: string }
  milestone: { id: string; description: string }
  commitDeadline: string | null
  revealDeadline: string | null
  weightedAccept: number
  weightedReject: number
  result: string | null
  votes: {
    id: string
    citizenId: string
    isExpert: boolean
    weight: number
    commitHash: string | null
    revealedVote: string | null
    citizen: { id: string; walletAddress: string; tier: string }
  }[]
}

const PHOTO_PLACEHOLDERS = [
  { label: 'Фото 1: Состояние до', color: 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700' },
  { label: 'Фото 2: Процесс работ', color: 'from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700' },
  { label: 'Фото 3: Завершение', color: 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700' },
]

export default function JuryVoting({ sessionId }: JuryVotingProps) {
  const [session, setSession] = useState<JurySessionData | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [vote, setVote] = useState<'accept' | 'reject' | null>(null)
  const [commitHash, setCommitHash] = useState<string | null>(null)
  const [salt, setSalt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)

  const storageKey = `jury_salt_${sessionId}`

  useEffect(() => {
    fetch(`/api/jury?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setPhase('error')
          return
        }
        setSession(data)

        if (data.status === 'FINALIZED' || data.status === 'ESCALATED') {
          setPhase('results')
        } else if (data.status === 'REVEAL_PHASE') {
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const d = JSON.parse(stored)
            setSalt(d.salt)
            setVote(d.vote)
            setCommitHash(d.hash)
          }
          setPhase('reveal')
          if (data.revealDeadline) {
            setTimeLeft(Math.max(0, Math.floor((new Date(data.revealDeadline).getTime() - Date.now()) / 1000)))
          }
        } else {
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const d = JSON.parse(stored)
            setSalt(d.salt)
            setVote(d.vote)
            setCommitHash(d.hash)
            setPhase('reveal')
          } else {
            setPhase('commit')
          }
          if (data.commitDeadline) {
            setTimeLeft(Math.max(0, Math.floor((new Date(data.commitDeadline).getTime() - Date.now()) / 1000)))
          }
        }
      })
      .catch(() => {
        setError('Не удалось загрузить сессию')
        setPhase('error')
      })
  }, [sessionId, storageKey])

  useEffect(() => {
    if (phase === 'results' || phase === 'loading' || phase === 'error') return
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [phase])

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleCommit = async () => {
    if (!vote || !session) return
    setLoading(true)

    try {
      const newSalt = generateSalt()
      const hash = await hashVoteCommitment(vote, newSalt)

      const res = await fetch('/api/jury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          citizenId: session.votes[0]?.citizenId,
          commitHash: hash,
        }),
      })
      const result = await res.json()

      if (result.error) {
        setError(result.error)
      } else {
        localStorage.setItem(storageKey, JSON.stringify({ salt: newSalt, vote, hash }))
        setSalt(newSalt)
        setCommitHash(hash)
        setPhase('reveal')
        if (session.revealDeadline) {
          setTimeLeft(Math.max(0, Math.floor((new Date(session.revealDeadline).getTime() - Date.now()) / 1000)))
        } else {
          setTimeLeft(24 * 3600)
        }
      }
    } catch {
      setError('Ошибка при отправке голоса')
    } finally {
      setLoading(false)
    }
  }

  const handleReveal = async () => {
    if (!vote || !salt || !session) return
    setLoading(true)

    try {
      const res = await fetch('/api/jury', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          citizenId: session.votes[0]?.citizenId,
          vote: vote.toUpperCase(),
          salt,
        }),
      })
      const result = await res.json()

      if (result.error) {
        setError(result.error)
      } else {
        const updated = await fetch(`/api/jury?sessionId=${sessionId}`).then((r) => r.json())
        setSession(updated)
        localStorage.removeItem(storageKey)
        setPhase('results')
      }
    } catch {
      setError('Ошибка при раскрытии голоса')
    } finally {
      setLoading(false)
    }
  }

  const totalWeight = session ? session.votes.reduce((sum, v) => sum + v.weight, 0) : 0
  const acceptWeight = session?.weightedAccept || 0
  const rejectWeight = session?.weightedReject || 0
  const acceptPct = totalWeight > 0 ? Math.round((acceptWeight / totalWeight) * 100) : 0
  const rejectPct = totalWeight > 0 ? 100 - acceptPct : 0
  const committed = session?.votes.filter((v) => v.commitHash).length || 0
  const revealed = session?.votes.filter((v) => v.revealedVote).length || 0
  const totalVoters = session?.votes.length || 0

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-5 text-red-600 dark:text-red-400 text-sm">
        {error || 'Неизвестная ошибка'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Session info */}
      {session && (
        <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="text-gray-700 dark:text-gray-300">{session.contract.title}</span> → {session.milestone.description}
          <span className="ml-2">•</span>
          <span className="ml-2">{committed}/{totalVoters} коммитов</span>
          <span className="ml-1">•</span>
          <span className="ml-1">{revealed}/{totalVoters} раскрыто</span>
        </div>
      )}

      {/* Phase indicator */}
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        {(['commit', 'reveal', 'results'] as const).map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              phase === p
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                : (phase === 'results' || (phase === 'reveal' && p === 'commit'))
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-gray-400 dark:text-gray-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                phase === p ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
              }`}>{i + 1}</span>
              {p === 'commit' ? 'Голосование' : p === 'reveal' ? 'Раскрытие' : 'Результаты'}
            </div>
            {i < 2 && <div className="w-4 h-0.5 bg-gray-200" />}
          </div>
        ))}
        <div className="ml-auto">
          {phase !== 'results' && timeLeft > 0 && (
            <div className={`text-sm font-mono font-medium px-3 py-1.5 rounded-lg border ${
              timeLeft < 60 ? 'text-red-500 dark:text-red-400 border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 animate-pulse' : 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950'
            }`}>
              {formatTime(timeLeft)}
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* COMMIT PHASE */}
      {phase === 'commit' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold mb-3">Фотоматериалы подрядчика</h3>
            <div className="grid grid-cols-3 gap-3">
              {PHOTO_PLACEHOLDERS.map((photo, i) => (
                <div key={i} className={`aspect-video rounded-xl bg-gradient-to-br ${photo.color} border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors group`}>
                  <svg width="24" height="24" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:stroke-emerald-500 transition-colors">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:text-gray-400 transition-colors">{photo.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold mb-3">Ваш голос</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setVote('accept')} className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                vote === 'accept' ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-500/20 shadow-md' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-500/40'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${vote === 'accept' ? 'bg-emerald-500' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <svg width="24" height="24" fill="none" stroke={vote === 'accept' ? 'white' : '#9ca3af'} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <div className={`font-semibold ${vote === 'accept' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>Принять</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">Работа выполнена</div>
                </div>
              </button>
              <button onClick={() => setVote('reject')} className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                vote === 'reject' ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-500/10 shadow-md' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-red-300 dark:hover:border-red-500/40'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${vote === 'reject' ? 'bg-red-500' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <svg width="24" height="24" fill="none" stroke={vote === 'reject' ? 'white' : '#9ca3af'} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <div>
                  <div className={`font-semibold ${vote === 'reject' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>Отклонить</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">Требует доработки</div>
                </div>
              </button>
            </div>
          </div>

          <button onClick={handleCommit} disabled={!vote || loading} className={`w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
            vote ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Отправка в БД...</>
            ) : (
              <><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Зафиксировать голос</>
            )}
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            SHA-256(голос + соль) сохраняется в БД. Соль — в localStorage для раскрытия.
          </p>
        </div>
      )}

      {/* REVEAL PHASE */}
      {phase === 'reveal' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Ваш зафиксированный голос</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Голос</div>
                <div className={`font-medium ${vote === 'accept' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {vote === 'accept' ? 'ПРИНЯТЬ' : 'ОТКЛОНИТЬ'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Хэш коммита (SHA-256)</div>
                <div className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all bg-gray-50 dark:bg-gray-950 p-2 rounded border border-gray-200 dark:border-gray-800">
                  {commitHash}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-700">
            <div className="flex items-start gap-2">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {committed}/{totalVoters} присяжных зафиксировали голоса. Раскройте свой голос.
            </div>
          </div>

          <button onClick={handleReveal} disabled={loading} className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md transition-all flex items-center justify-center gap-2">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Раскрытие голоса...</>
            ) : (
              <><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>Раскрыть мой голос</>
            )}
          </button>
        </div>
      )}

      {/* RESULTS PHASE */}
      {phase === 'results' && (
        <div className="space-y-5">
          <div className="text-center py-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
              session?.result === 'ACCEPT' ? 'bg-emerald-50 dark:bg-emerald-500/20' : session?.result === 'REJECT' ? 'bg-red-50 dark:bg-red-500/10' : 'bg-yellow-50 dark:bg-yellow-500/20'
            }`}>
              <svg width="32" height="32" fill="none" stroke={session?.result === 'ACCEPT' ? '#10b981' : session?.result === 'REJECT' ? '#ef4444' : '#eab308'} strokeWidth="2" viewBox="0 0 24 24">
                {session?.result === 'ACCEPT'
                  ? <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  : session?.result === 'REJECT'
                  ? <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  : <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              </svg>
            </div>
            <h3 className="text-gray-900 dark:text-white font-bold text-xl mb-1">
              {session?.status === 'ESCALATED' ? 'Ничья — эскалация' : 'Голосование завершено'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {session?.result === 'ACCEPT' ? 'Этап принят большинством голосов' : session?.result === 'REJECT' ? 'Этап отклонён' : 'Решение не принято, передано на расширенное жюри'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <h4 className="text-gray-500 dark:text-gray-400 text-sm mb-4">Распределение голосов (взвешенное)</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Принято</span>
                  <span className="text-gray-900 dark:text-white font-bold">{acceptWeight} / {totalWeight}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${acceptPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-red-500 dark:text-red-400 font-medium">Отклонено</span>
                  <span className="text-gray-900 dark:text-white font-bold">{rejectWeight} / {totalWeight}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${rejectPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Individual votes */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <h4 className="text-gray-500 dark:text-gray-400 text-sm mb-3">Голоса присяжных</h4>
            <div className="space-y-2">
              {session?.votes.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${v.isExpert ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      {v.isExpert ? 'Эксперт' : 'Гражданин'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{v.citizen.walletAddress.slice(0, 12)}...</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs">x{v.weight}</span>
                  </div>
                  <span className={`font-medium ${
                    v.revealedVote === 'ACCEPT' ? 'text-emerald-600 dark:text-emerald-400' : v.revealedVote === 'REJECT' ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {v.revealedVote === 'ACCEPT' ? 'Принял' : v.revealedVote === 'REJECT' ? 'Отклонил' : v.commitHash ? 'Скрыт' : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
