'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'

const AlmatyMap = dynamic(() => import('../components/AlmatyMap'), { ssr: false })

const STATS = [
  { label: 'Контрактов под мониторингом', value: '147', icon: '📋', color: 'text-blue-600 dark:text-blue-400' },
  { label: 'Общая сумма', value: '38B ₸', icon: '💰', color: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'Нарушений выявлено', value: '26', icon: '⚠️', color: 'text-red-500 dark:text-red-400' },
  { label: 'Граждан-присяжных', value: '1,247', icon: '👥', color: 'text-purple-600 dark:text-purple-400' },
]

const LEGEND = [
  { color: '#10b981', label: 'В срок' },
  { color: '#f59e0b', label: 'Риск (< 7 дн.)' },
  { color: '#ef4444', label: 'Просрочен / Штраф' },
  { color: '#3b82f6', label: 'Завершён' },
]

export default function HomePage() {
  return (
    <main className="h-screen flex flex-col pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Stats banner */}
      <div className="bg-white dark:bg-gray-950/95 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-6">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex items-center gap-2">
                  <span className="text-lg">{stat.icon}</span>
                  <div>
                    <div className={`font-bold text-lg leading-none ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Link
                href="/contracts"
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                Все контракты
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Стать присяжным
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        <AlmatyMap />

        {/* Legend */}
        <div className="absolute bottom-6 left-4 z-[1000] bg-white dark:bg-gray-950/90 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-3 uppercase tracking-wider">Статусы контрактов</div>
          <div className="space-y-2">
            {LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ background: item.color, boxShadow: `0 0 6px ${item.color}40` }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info overlay */}
        <div className="absolute bottom-6 right-4 z-[1000] bg-white dark:bg-gray-950/90 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-lg max-w-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
              <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-gray-900 dark:text-white font-medium text-sm mb-1">Кликните на маркер</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                Каждый маркер — активный государственный контракт. Нажмите для просмотра деталей.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
