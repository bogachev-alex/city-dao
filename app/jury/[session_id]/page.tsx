'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import JuryVoting from '../../../components/JuryVoting'

export default function JuryPage() {
  const params = useParams<{ session_id: string }>()
  const sessionId = params.session_id
  const [sessionInfo, setSessionInfo] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/jury?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setSessionInfo(data)
      })
      .catch(() => {})
  }, [sessionId])

  return (
    <div className="min-h-screen pt-16 bg-gray-950">
      {/* Back nav */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            href={sessionInfo?.contract ? `/contracts/${sessionInfo.contract.id}` : '/contracts'}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            {sessionInfo?.contract?.title || 'Контракты'}
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-400 text-sm">Голосование жюри</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Голосование присяжного</h1>
              <p className="text-gray-400 text-sm">
                {sessionInfo?.milestone?.description || `Сессия #${sessionId.slice(0, 8)}`}
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-xs mb-1">Метод голосования</div>
                <div className="text-white font-medium">Commit-Reveal</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Присяжных</div>
                <div className="text-white font-medium">{sessionInfo?.votes?.length || '...'}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Статус</div>
                <div className={`font-medium ${
                  sessionInfo?.status === 'FINALIZED' ? 'text-emerald-400' :
                  sessionInfo?.status === 'ESCALATED' ? 'text-yellow-400' :
                  'text-blue-400'
                }`}>
                  {sessionInfo?.status === 'COMMIT_PHASE' ? 'Фаза коммита' :
                   sessionInfo?.status === 'REVEAL_PHASE' ? 'Фаза раскрытия' :
                   sessionInfo?.status === 'FINALIZED' ? 'Завершено' :
                   sessionInfo?.status === 'ESCALATED' ? 'Эскалация' :
                   sessionInfo?.status || '...'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Voting component */}
        <JuryVoting sessionId={sessionId} />

        {/* How it works */}
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-gray-400 text-sm font-medium mb-3">Как работает commit-reveal?</h3>
          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">1.</span>
              <span>Вы голосуете (Accept/Reject), и ваш голос шифруется: <code className="text-emerald-400/80">SHA-256(голос + соль)</code>. Хэш сохраняется в БД.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">2.</span>
              <span>После того, как все зафиксировали голоса, начинается фаза раскрытия. Вы раскрываете оригинальный голос и соль.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">3.</span>
              <span>Смарт-контракт проверяет: <code className="text-emerald-400/80">SHA-256(голос + соль) == хэш</code>. Если совпадает — голос засчитан.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">4.</span>
              <span>Присяжные, проголосовавшие с большинством, получают +10 очков репутации. Против — -5.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
