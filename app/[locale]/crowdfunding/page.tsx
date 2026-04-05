'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/routing'
import {
  DEMO_CAMPAIGNS,
  Campaign,
  CampaignStatus,
  CampaignCategory,
  CATEGORY_CONFIG,
  CAMPAIGN_STATUS_CONFIG,
  formatTenge,
  normalizeCampaign,
  getEffectiveCrowdfundingStatus,
} from '@/lib/crowdfunding'
import { fetchCampaigns } from '@/lib/api'
import { DISTRICTS } from '@/lib/contracts'
import CampaignCard from '@/components/CampaignCard'
import { useRedirectContractorFromCitizenEconomyPages } from '@/lib/contractorCitizenRoutes'

const STATUS_FILTERS: { value: CampaignStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Сбор средств' },
  { value: 'funded', label: 'Собрано' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершённые' },
  { value: 'expired', label: 'Истёкшие' },
]

const CATEGORY_FILTERS: { value: CampaignCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Все категории' },
  ...Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({
    value: key as CampaignCategory,
    label: cfg.label,
  })),
]

export default function CrowdfundingPage() {
  const { holdUi } = useRedirectContractorFromCitizenEconomyPages()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')

  useEffect(() => {
    fetchCampaigns()
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCampaigns(data.map(normalizeCampaign))
        } else {
          setCampaigns(DEMO_CAMPAIGNS)
        }
      })
      .catch(() => setCampaigns(DEMO_CAMPAIGNS))
      .finally(() => setLoading(false))
  }, [])
  const [categoryFilter, setCategoryFilter] = useState<CampaignCategory | 'all'>('all')
  const [districtFilter, setDistrictFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = campaigns.filter((c) => {
    const effective = getEffectiveCrowdfundingStatus(c)
    if (statusFilter !== 'all' && effective !== statusFilter) return false
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false
    if (districtFilter !== 'all' && c.district !== districtFilter) return false
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase()) && !c.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const activeCampaigns = campaigns.filter((c) => getEffectiveCrowdfundingStatus(c) === 'active')
  const totalRaised = campaigns.reduce((sum, c) => sum + c.citizen_raised, 0)
  const totalDonors = campaigns.reduce((sum, c) => sum + c.donor_count, 0)
  const fundedCount = campaigns.filter((c) => c.status === 'funded' || c.status === 'in_progress' || c.status === 'completed').length

  if (holdUi) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Гражданский краудфандинг</div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Инициативное бюджетирование
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Граждане вкладывают — государство умножает. Деньги в смарт-контракте до завершения проекта.
              </p>
            </div>
            <div className="flex gap-3">
              {[
                { label: 'Активных', value: activeCampaigns.length, color: 'text-blue-600' },
                { label: 'Собрано', value: formatTenge(totalRaised), color: 'text-emerald-600' },
                { label: 'Доноров', value: totalDonors, color: 'text-gray-900' },
                { label: 'Профинансировано', value: fundedCount, color: 'text-emerald-600' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-center">
                  <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* How it works — collapsible */}
        <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-500/10 dark:to-blue-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Как это работает
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">1</span>
              <div><span className="font-medium text-gray-900 dark:text-white">Создайте кампанию</span> — опишите проект и укажите бюджет</div>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">2</span>
              <div><span className="font-medium text-gray-900 dark:text-white">Граждане скидываются</span> — от 500 ₸ до 500 000 ₸</div>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">3</span>
              <div><span className="font-medium text-gray-900 dark:text-white">Государство добавляет</span> — субсидия по категории проекта</div>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">4</span>
              <div><span className="font-medium text-gray-900 dark:text-white">Проект запускается</span> — через Amanat Protocol с жюри</div>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-600 dark:text-gray-400 border-t border-emerald-200/60 dark:border-emerald-500/20 pt-3">
            У каждой кампании есть срок сбора (дата и время дедлайна). Если к этому моменту цель граждан не достигнута,
            собранные средства возвращаются донорам — средства не удерживаются на неудачной кампании.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Поиск по названию или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Status filter */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === f.value
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CampaignCategory | 'all')}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
            >
              {CATEGORY_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {/* District filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
            >
              <option value="all">Все районы</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count + create button */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Найдено: <span className="text-gray-900 dark:text-white font-medium">{filtered.length}</span> кампаний
          </div>
          <Link
            href="/crowdfunding/new"
            className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" />
            </svg>
            Создать кампанию
          </Link>
        </div>

        {/* Campaign grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-gray-600 dark:text-gray-300 font-medium mb-2">Кампании не найдены</div>
            <div className="text-gray-400 dark:text-gray-500 text-sm">Попробуйте изменить фильтры или создайте новую кампанию</div>
          </div>
        )}

        {/* Matching ratios info */}
        <div className="mt-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Модели субсидирования</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(CATEGORY_CONFIG).filter(([key]) => key !== 'commercial').map(([key, cfg]) => (
              <div key={key} className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span>{cfg.icon}</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">{cfg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${cfg.statePercent}%` }} />
                  </div>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{cfg.statePercent}%</span>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Государство: {cfg.statePercent}% / Граждане: {100 - cfg.statePercent}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
