'use client'

import { useTranslations } from 'next-intl'
import { Milestone, MilestoneStatus, JurySessionSummary, pickJurySessionForMilestone } from '@/lib/contracts'
import { Link } from '@/i18n/routing'

interface MilestoneTrackerProps {
  milestones: Milestone[]
  contractId: string
  /** Only registered citizens vote in jury; hide for contractors / akimat / guests */
  showCitizenJuryVote?: boolean
  jurySessions?: JurySessionSummary[]
  /** Connected wallet or auth id when it is a Solana address */
  jurorWallet?: string | null
}

export default function MilestoneTracker({
  milestones,
  contractId,
  showCitizenJuryVote = false,
  jurySessions,
  jurorWallet = null,
}: MilestoneTrackerProps) {
  const t = useTranslations('components.milestoneTracker')

  const statusConfig: Record<MilestoneStatus, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
    pending: {
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
      label: t('pending'),
      color: 'text-gray-400 dark:text-gray-500',
      bg: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
    },
    submitted: {
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: t('submitted'),
      color: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40',
    },
    under_review: {
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      label: t('underReview'),
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-500/20 border-yellow-300 dark:border-yellow-500/40',
    },
    accepted: {
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: t('accepted'),
      color: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/50',
    },
    rejected: {
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: t('rejected'),
      color: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30',
    },
    overdue: {
      icon: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      label: t('overdue'),
      color: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30',
    },
  }

  const activeIndex = milestones.findIndex((m) => m.status === 'under_review' || m.status === 'submitted')

  const juryHref = (milestoneId: string) => `/jury/${contractId}-${milestoneId}`

  return (
    <div className="space-y-0">
      {milestones.map((milestone, index) => {
        const config = statusConfig[milestone.status]
        const isActive = index === activeIndex
        const isLast = index === milestones.length - 1
        const session =
          milestone.status === 'under_review' ? pickJurySessionForMilestone(jurySessions, milestone.id) : null
        const votes = session?.votes ?? []
        const totalJurors = votes.length
        const committed = votes.filter((v) => v.commitHash).length
        const revealed = votes.filter((v) => v.revealedVote).length
        const myVote = jurorWallet ? votes.find((v) => v.walletAddress === jurorWallet) : undefined

        let showVoteCta = false
        let voteLinkLabel = t('voteAsJuror')
        if (
          milestone.status === 'under_review' &&
          showCitizenJuryVote &&
          jurorWallet &&
          session &&
          (session.status === 'COMMIT_PHASE' || session.status === 'REVEAL_PHASE')
        ) {
          if (!myVote) {
            if (session.status === 'COMMIT_PHASE') {
              showVoteCta = true
              voteLinkLabel = t('voteAsJuror')
            }
          } else if (!myVote.revealedVote) {
            showVoteCta = true
            voteLinkLabel = myVote.commitHash ? t('continueRevealVote') : t('voteAsJuror')
          }
        }

        const juryStatusLines: string[] = []
        if (milestone.status === 'under_review' && session) {
          if (session.status === 'FINALIZED') {
            if (session.result === 'ACCEPT') juryStatusLines.push(t('juryResultAccepted'))
            else if (session.result === 'REJECT') juryStatusLines.push(t('juryResultRejected'))
            else juryStatusLines.push(t('juryFinished'))
          } else if (session.status === 'ESCALATED') {
            juryStatusLines.push(t('juryEscalated'))
          } else if (session.status === 'COMMIT_PHASE' || session.status === 'REVEAL_PHASE') {
            if (totalJurors > 0) {
              juryStatusLines.push(t('juryCommitsProgress', { committed, total: totalJurors }))
              juryStatusLines.push(t('juryRevealsProgress', { revealed, total: totalJurors }))
            }
            if (myVote?.commitHash && !myVote.revealedVote) {
              juryStatusLines.push(t('youCommittedPendingReveal'))
            } else if (myVote?.revealedVote) {
              juryStatusLines.push(
                myVote.revealedVote === 'ACCEPT' ? t('youRevealedAccept') : t('youRevealedReject'),
              )
            } else if (
              showCitizenJuryVote &&
              jurorWallet &&
              !myVote &&
              totalJurors > 0 &&
              session.status === 'REVEAL_PHASE'
            ) {
              juryStatusLines.push(t('missedCommitShort'))
            }
          }
        }

        return (
          <div key={milestone.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${config.bg} ${config.color} ${
                  isActive ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-yellow-400' : ''
                }`}
              >
                {config.icon}
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-gray-200 my-1 min-h-[1.5rem]" />}
            </div>

            <div className={`pb-6 flex-1 ${isLast ? 'pb-0' : ''}`}>
              <div
                className={`rounded-xl border p-4 transition-all ${
                  isActive
                    ? 'border-yellow-300 dark:border-yellow-500/40 bg-yellow-50 dark:bg-yellow-500/20'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className={`font-medium text-sm ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {milestone.desc}
                  </h4>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color} border`}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {t('day')} {milestone.deadline_days}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('tranche')} {milestone.tranche_pct}%
                  </span>
                  {isActive && (
                    <span className="text-yellow-600 dark:text-yellow-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse inline-block" />
                      {t('activeStage')}
                    </span>
                  )}
                </div>

                {milestone.status === 'under_review' && juryStatusLines.length > 0 && (
                  <ul className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    {juryStatusLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}

                {milestone.status === 'under_review' && showCitizenJuryVote && showVoteCta && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                    <Link
                      href={juryHref(milestone.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition-colors"
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {voteLinkLabel}
                    </Link>
                  </div>
                )}
                {milestone.status === 'under_review' && !showCitizenJuryVote && (
                  <p className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                    {t('juryReviewNote')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
