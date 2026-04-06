'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import JuryVoting from '@/components/JuryVoting'
import { useAuth } from '@/components/AuthContext'
import { getContractDetailHref } from '@/lib/contracts'

export default function JuryPage() {
  const params = useParams<{ session_id: string }>()
  const t = useTranslations('jury')
  const { user, loading: authLoading } = useAuth()
  const sessionId = params.session_id
  const [sessionInfo, setSessionInfo] = useState<any>(null)

  const juryBlocked =
    !authLoading && user && user.role !== 'CITIZEN'

  useEffect(() => {
    fetch(`/api/jury?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setSessionInfo(data)
      })
      .catch(() => {})
  }, [sessionId])

  const commitsRecordedCount = useMemo(() => {
    const votes = sessionInfo?.votes as Array<{ commitHash?: string | null }> | undefined
    if (!votes?.length) return 0
    return votes.filter((v) => Boolean(v.commitHash)).length
  }, [sessionInfo?.votes])

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Back nav */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            href={sessionInfo?.contract ? getContractDetailHref(sessionInfo.contract.id, sessionInfo.contract.onChainPubkey) : '/contracts'}
            className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            {sessionInfo?.contract?.title || t('contracts')}
          </Link>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <span className="text-gray-500 dark:text-gray-400 text-sm">{t('juryVoting')}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center">
              <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('jurorVoting')}</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {sessionInfo?.milestone?.description || `${t('session')} #${sessionId.slice(0, 8)}`}
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-400 dark:text-gray-500 text-xs mb-1">{t('votingMethod')}</div>
                <div className="text-gray-900 dark:text-white font-medium">Commit-Reveal</div>
              </div>
              <div>
                <div className="text-gray-400 dark:text-gray-500 text-xs mb-1">{t('commitsRecorded')}</div>
                <div className="text-gray-900 dark:text-white font-medium">
                  {sessionInfo?.votes ? commitsRecordedCount : '...'}
                </div>
              </div>
              <div>
                <div className="text-gray-400 dark:text-gray-500 text-xs mb-1">{t('status')}</div>
                <div className={`font-medium ${
                  sessionInfo?.status === 'FINALIZED' ? 'text-emerald-600 dark:text-emerald-400' :
                  sessionInfo?.status === 'ESCALATED' ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-blue-600 dark:text-blue-400'
                }`}>
                  {sessionInfo?.status === 'COMMIT_PHASE' ? t('commitPhase') :
                   sessionInfo?.status === 'REVEAL_PHASE' ? t('revealPhase') :
                   sessionInfo?.status === 'FINALIZED' ? t('finalized') :
                   sessionInfo?.status === 'ESCALATED' ? t('escalation') :
                   sessionInfo?.status || '...'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Voting: only citizens (jurors); contractors / akimat observe on contract page */}
        {juryBlocked ? (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">{t('citizensOnlyTitle')}</h2>
            <p className="text-sm text-amber-800 dark:text-amber-300/90 mb-4">{t('citizensOnlyLead')}</p>
            <Link
              href={sessionInfo?.contract ? getContractDetailHref(sessionInfo.contract.id, sessionInfo.contract.onChainPubkey) : '/contracts'}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              {t('openContract')}
            </Link>
          </div>
        ) : (
          <JuryVoting sessionId={sessionId} />
        )}

        {/* How it works */}
        <div className="mt-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-3">{t('howCommitReveal')}</h3>
          <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex gap-2">
              <span className="text-emerald-500 dark:text-emerald-400 font-bold shrink-0">1.</span>
              <span dangerouslySetInnerHTML={{ __html: t.raw('step1') }} />
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-500 dark:text-emerald-400 font-bold shrink-0">2.</span>
              <span>{t.raw('step2')}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-500 dark:text-emerald-400 font-bold shrink-0">3.</span>
              <span dangerouslySetInnerHTML={{ __html: t.raw('step3') }} />
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-500 dark:text-emerald-400 font-bold shrink-0">4.</span>
              <span>{t.raw('step4')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
