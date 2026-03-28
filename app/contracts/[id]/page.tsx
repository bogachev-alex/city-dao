import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getContractById, getDaysUntilDeadline, getMilestoneCompletedCount, formatAmount, DEMO_CONTRACTS } from '../../../lib/contracts'
import MilestoneTracker from '../../../components/MilestoneTracker'
import PenaltyCalculator from '../../../components/PenaltyCalculator'

const statusConfig = {
  active: { label: 'Активный', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  penalized: { label: 'Штраф', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  completed: { label: 'Завершён', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  disputed: { label: 'Спор', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
}

export function generateStaticParams() {
  return DEMO_CONTRACTS.map((c) => ({ id: c.id }))
}

interface PageProps {
  params: { id: string }
}

export default function ContractDetailPage({ params }: PageProps) {
  const contract = getContractById(params.id)

  if (!contract) {
    notFound()
  }

  const daysLeft = getDaysUntilDeadline(contract.deadline)
  const completed = getMilestoneCompletedCount(contract)
  const total = contract.milestones.length
  const progressPct = Math.round((completed / total) * 100)
  const status = statusConfig[contract.status]

  const PHOTO_EVIDENCE = [
    { label: 'Начало работ', date: '10.03.2026' },
    { label: 'Промежуточный этап', date: '18.03.2026' },
    { label: 'Текущее состояние', date: '25.03.2026' },
  ]

  const activeReviewMilestone = contract.milestones.find((m) => m.status === 'under_review')

  return (
    <div className="min-h-screen pt-16 bg-gray-950">
      {/* Back nav */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/contracts" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Реестр контрактов
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-400 text-sm truncate">{contract.title}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header card */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border mb-3 ${status.color}`}>
                    {status.label}
                  </span>
                  <h1 className="text-2xl font-bold text-white leading-tight">{contract.title}</h1>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Подрядчик</div>
                  <div className="text-white text-sm font-medium">{contract.contractor}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Район</div>
                  <div className="text-white text-sm font-medium">{contract.district}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Сумма</div>
                  <div className="text-emerald-400 text-sm font-bold">{formatAmount(contract.amount_usdc)} USDC</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Дедлайн</div>
                  <div className={`text-sm font-medium ${
                    daysLeft < 0 ? 'text-red-400' : daysLeft < 7 ? 'text-yellow-400' : 'text-white'
                  }`}>
                    {daysLeft < 0
                      ? `Просрочен ${Math.abs(daysLeft)} дн.`
                      : `${daysLeft} дн. осталось`}
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-5 pt-5 border-t border-gray-800">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-400">Общий прогресс</span>
                  <span className="text-white font-medium">{completed}/{total} этапов • {progressPct}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Milestone tracker */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Этапы выполнения
              </h2>
              <MilestoneTracker milestones={contract.milestones} contractId={contract.id} />
            </div>

            {/* Photo evidence */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Фотодоказательства
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {PHOTO_EVIDENCE.map((photo, i) => (
                  <div
                    key={i}
                    className="aspect-video bg-gradient-to-br from-gray-800 to-gray-700 rounded-xl border border-gray-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-500/40 transition-all group"
                  >
                    <svg width="28" height="28" fill="none" stroke="#4b5563" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:stroke-emerald-500 transition-colors">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="text-center px-2">
                      <div className="text-xs text-gray-500 group-hover:text-gray-400">{photo.label}</div>
                      <div className="text-xs text-gray-600">{photo.date}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">Фото хранятся в IPFS. Хэш подтверждён подрядчиком и присяжными.</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Penalty calculator */}
            <PenaltyCalculator contract={contract} />

            {/* Jury status */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Жюри
              </h3>
              {activeReviewMilestone ? (
                <div className="space-y-3">
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-300">
                    Активная проверка этапа
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Проголосовало</span>
                    <span className="text-white font-medium">7 / 9</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: '78%' }} />
                  </div>
                  <Link
                    href={`/jury/${contract.id}-${activeReviewMilestone.id}`}
                    className="block w-full text-center py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                  >
                    Участвовать в голосовании
                  </Link>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Активных сессий нет</div>
              )}
            </div>

            {/* Contract meta */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Метаданные</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'ID контракта', value: `#${contract.id.padStart(6, '0')}` },
                  { label: 'Координаты', value: `${contract.lat}, ${contract.lng}` },
                  { label: 'Эскроу (20%)', value: `${formatAmount(contract.escrow_amount)} USDC` },
                  { label: 'Статус', value: statusConfig[contract.status].label },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="text-gray-300 font-mono text-xs">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
