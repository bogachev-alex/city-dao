'use client'

import { Milestone, MilestoneStatus } from '../lib/contracts'

interface MilestoneTrackerProps {
  milestones: Milestone[]
  contractId: string
}

const statusConfig: Record<MilestoneStatus, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  pending: {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    label: 'Ожидание',
    color: 'text-gray-400',
    bg: 'bg-gray-700 border-gray-600',
  },
  submitted: {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Подан',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20 border-blue-500/40',
  },
  under_review: {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    label: 'На проверке',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20 border-yellow-500/40',
  },
  accepted: {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Принят',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20 border-emerald-500/40',
  },
  rejected: {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Отклонён',
    color: 'text-red-400',
    bg: 'bg-red-500/20 border-red-500/40',
  },
  overdue: {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    label: 'Просрочен',
    color: 'text-red-400',
    bg: 'bg-red-500/20 border-red-500/40',
  },
}

export default function MilestoneTracker({ milestones, contractId }: MilestoneTrackerProps) {
  const activeIndex = milestones.findIndex((m) => m.status === 'under_review' || m.status === 'submitted')

  return (
    <div className="space-y-0">
      {milestones.map((milestone, index) => {
        const config = statusConfig[milestone.status]
        const isActive = index === activeIndex
        const isLast = index === milestones.length - 1

        return (
          <div key={milestone.id} className="flex gap-4">
            {/* Timeline line + icon */}
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${config.bg} ${config.color} ${
                  isActive ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-yellow-400' : ''
                }`}
              >
                {config.icon}
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-gray-800 my-1 min-h-[1.5rem]" />}
            </div>

            {/* Content */}
            <div className={`pb-6 flex-1 ${isLast ? 'pb-0' : ''}`}>
              <div className={`rounded-xl border p-4 transition-all ${
                isActive ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-gray-800 bg-gray-900/50'
              }`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className={`font-medium text-sm ${isActive ? 'text-white' : 'text-gray-300'}`}>
                    {milestone.desc}
                  </h4>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color} border`}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    День {milestone.deadline_days}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Транш: {milestone.tranche_pct}%
                  </span>
                  {isActive && (
                    <span className="text-yellow-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
                      Активный этап
                    </span>
                  )}
                </div>

                {/* Jury vote button for under_review */}
                {milestone.status === 'under_review' && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <a
                      href={`/jury/${contractId}-${milestone.id}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Голосовать как присяжный
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
