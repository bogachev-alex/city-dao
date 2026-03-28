'use client'

import { useEffect, useState } from 'react'
import { generateSalt, hashVoteCommitment } from '../lib/crypto'

interface JuryVotingProps {
  sessionId: string
}

type Phase = 'commit' | 'reveal' | 'results'

const MOCK_RESULTS = {
  accept: 7,
  reject: 2,
  total: 9,
}

const PHOTO_PLACEHOLDERS = [
  { label: 'Фото 1: Состояние до', color: 'from-slate-800 to-slate-700' },
  { label: 'Фото 2: Процесс работ', color: 'from-slate-700 to-slate-600' },
  { label: 'Фото 3: Завершение', color: 'from-slate-800 to-slate-700' },
]

export default function JuryVoting({ sessionId }: JuryVotingProps) {
  const [phase, setPhase] = useState<Phase>('commit')
  const [vote, setVote] = useState<'accept' | 'reject' | null>(null)
  const [commitHash, setCommitHash] = useState<string | null>(null)
  const [salt, setSalt] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300) // 5 min countdown
  const [loading, setLoading] = useState(false)
  const [repChange, setRepChange] = useState(0)

  const storageKey = `jury_salt_${sessionId}`

  useEffect(() => {
    // Check localStorage for existing salt
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const data = JSON.parse(stored)
      setSalt(data.salt)
      setVote(data.vote)
      setCommitHash(data.hash)
      setPhase('reveal')
    }
  }, [storageKey])

  useEffect(() => {
    if (phase === 'results') return
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [phase])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleCommit = async () => {
    if (!vote) return
    setLoading(true)
    const newSalt = generateSalt()
    const hash = await hashVoteCommitment(vote, newSalt)
    const data = { salt: newSalt, vote, hash }
    localStorage.setItem(storageKey, JSON.stringify(data))
    setSalt(newSalt)
    setCommitHash(hash)
    setTimeLeft(300)
    setLoading(false)
    setPhase('reveal')
  }

  const handleReveal = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1200)) // simulate tx
    setRevealed(true)
    setRepChange(vote === 'accept' ? 15 : 12) // mock rep change
    setLoading(false)
    setPhase('results')
  }

  const acceptPct = Math.round((MOCK_RESULTS.accept / MOCK_RESULTS.total) * 100)
  const rejectPct = 100 - acceptPct

  return (
    <div className="space-y-6">
      {/* Phase indicator */}
      <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl p-4">
        {(['commit', 'reveal', 'results'] as Phase[]).map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              phase === p
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : phase === 'results' || (phase === 'reveal' && p === 'commit')
                ? 'text-gray-600'
                : 'text-gray-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                phase === p ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-600'
              }`}>{i + 1}</span>
              {p === 'commit' ? 'Голосование' : p === 'reveal' ? 'Раскрытие' : 'Результаты'}
            </div>
            {i < 2 && <div className="w-4 h-0.5 bg-gray-800" />}
          </div>
        ))}
        <div className="ml-auto">
          {phase !== 'results' && (
            <div className={`text-sm font-mono font-medium px-3 py-1.5 rounded-lg border ${
              timeLeft < 60 ? 'text-red-400 border-red-500/30 bg-red-500/10 animate-pulse' : 'text-gray-400 border-gray-700 bg-gray-900'
            }`}>
              {formatTime(timeLeft)}
            </div>
          )}
        </div>
      </div>

      {/* COMMIT PHASE */}
      {phase === 'commit' && (
        <div className="space-y-5">
          {/* Evidence photos */}
          <div>
            <h3 className="text-white font-semibold mb-3">Фотоматериалы подрядчика</h3>
            <div className="grid grid-cols-3 gap-3">
              {PHOTO_PLACEHOLDERS.map((photo, i) => (
                <div
                  key={i}
                  className={`aspect-video rounded-xl bg-gradient-to-br ${photo.color} border border-gray-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-500/40 transition-colors group`}
                >
                  <svg width="24" height="24" fill="none" stroke="#6b7280" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:stroke-emerald-400 transition-colors">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{photo.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vote selection */}
          <div>
            <h3 className="text-white font-semibold mb-3">Ваш голос</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setVote('accept')}
                className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                  vote === 'accept'
                    ? 'border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-500/20'
                    : 'border-gray-800 bg-gray-900 hover:border-emerald-500/40'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  vote === 'accept' ? 'bg-emerald-500' : 'bg-gray-800'
                }`}>
                  <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className={`font-semibold ${vote === 'accept' ? 'text-emerald-400' : 'text-gray-300'}`}>Принять</div>
                  <div className="text-xs text-gray-500">Работа выполнена</div>
                </div>
              </button>
              <button
                onClick={() => setVote('reject')}
                className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                  vote === 'reject'
                    ? 'border-red-500 bg-red-500/15 shadow-lg shadow-red-500/20'
                    : 'border-gray-800 bg-gray-900 hover:border-red-500/40'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  vote === 'reject' ? 'bg-red-500' : 'bg-gray-800'
                }`}>
                  <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <div className={`font-semibold ${vote === 'reject' ? 'text-red-400' : 'text-gray-300'}`}>Отклонить</div>
                  <div className="text-xs text-gray-500">Требует доработки</div>
                </div>
              </button>
            </div>
          </div>

          {/* Commit button */}
          <button
            onClick={handleCommit}
            disabled={!vote || loading}
            className={`w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              vote
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Создание коммита...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Зафиксировать голос
              </>
            )}
          </button>
          <p className="text-xs text-gray-600 text-center">
            Голос будет зашифрован: SHA-256(голос + случайная соль). Соль хранится в localStorage.
          </p>
        </div>
      )}

      {/* REVEAL PHASE */}
      {phase === 'reveal' && (
        <div className="space-y-5">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Ваш зафиксированный голос</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Голос</div>
                <div className={`font-medium ${vote === 'accept' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {vote === 'accept' ? 'ПРИНЯТЬ' : 'ОТКЛОНИТЬ'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Хэш коммита (SHA-256)</div>
                <div className="font-mono text-xs text-gray-400 break-all bg-gray-950 p-2 rounded border border-gray-800">
                  {commitHash}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-300">
            <div className="flex items-start gap-2">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Все присяжные зафиксировали голоса. Теперь раскройте свой голос для подтверждения.
            </div>
          </div>

          <button
            onClick={handleReveal}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Раскрытие голоса...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Раскрыть мой голос
              </>
            )}
          </button>
        </div>
      )}

      {/* RESULTS PHASE */}
      {phase === 'results' && (
        <div className="space-y-5">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-xl mb-1">Голосование завершено</h3>
            <p className="text-gray-400 text-sm">Этап принят большинством голосов</p>
          </div>

          {/* Vote breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h4 className="text-gray-400 text-sm mb-4">Распределение голосов</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-emerald-400 font-medium">Принято</span>
                  <span className="text-white font-bold">{MOCK_RESULTS.accept}/{MOCK_RESULTS.total}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${acceptPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-red-400 font-medium">Отклонено</span>
                  <span className="text-white font-bold">{MOCK_RESULTS.reject}/{MOCK_RESULTS.total}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${rejectPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Reputation change */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400 mb-1">Изменение репутации</div>
                <div className="text-white font-semibold">Ваш голос совпал с большинством</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-emerald-400">+{repChange}</div>
                <div className="text-xs text-gray-500">очков репутации</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
