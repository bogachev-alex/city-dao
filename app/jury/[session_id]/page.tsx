'use client'

import Link from 'next/link'
import JuryVoting from '../../../components/JuryVoting'

interface PageProps {
  params: { session_id: string }
}

export default function JuryPage({ params }: PageProps) {
  const sessionId = params.session_id
  const parts = sessionId.split('-')
  const contractId = parts[0]

  return (
    <div className="min-h-screen pt-16 bg-gray-950">
      {/* Back nav */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            href={`/contracts/${contractId}`}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Контракт #{contractId}
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
              <p className="text-gray-400 text-sm">Сессия #{sessionId}</p>
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
                <div className="text-white font-medium">9 граждан</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Ваша репутация</div>
                <div className="text-emerald-400 font-medium">340 очков</div>
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
              <span>Вы голосуете (Accept/Reject), и ваш голос шифруется: <code className="text-emerald-400/80">SHA-256(голос + соль)</code>. Хэш отправляется on-chain.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">2.</span>
              <span>После того, как все зафиксировали голоса, начинается фаза раскрытия. Вы раскрываете оригинальный голос и соль.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">3.</span>
              <span>Смарт-контракт проверяет: <code className="text-emerald-400/80">SHA-256(голос + соль) == хэш</code>. Если всё совпадает, голос засчитывается.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">4.</span>
              <span>Присяжные, проголосовавшие с большинством, получают +15 очков репутации. Меньшинство — +5.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
