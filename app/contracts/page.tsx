'use client'

import { useState, useEffect } from 'react'
import { DEMO_CONTRACTS, DISTRICTS, Contract, ContractStatus, normalizeContract } from '../../lib/contracts'
import { fetchContracts } from '../../lib/api'
import ContractCard from '../../components/ContractCard'

const STATUS_FILTERS: { value: ContractStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'penalized', label: 'Со штрафом' },
  { value: 'completed', label: 'Завершённые' },
  { value: 'disputed', label: 'Спорные' },
]

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all')
  const [districtFilter, setDistrictFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchContracts()
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setContracts(data.map(normalizeContract))
        } else {
          setContracts(DEMO_CONTRACTS)
        }
      })
      .catch(() => setContracts(DEMO_CONTRACTS))
      .finally(() => setLoading(false))
  }, [])

  const filtered = contracts.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (districtFilter !== 'all' && c.district !== districtFilter) return false
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase()) && !c.contractor.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const counts = {
    active: contracts.filter((c) => c.status === 'active').length,
    penalized: contracts.filter((c) => c.status === 'penalized').length,
    completed: contracts.filter((c) => c.status === 'completed').length,
    disputed: contracts.filter((c) => c.status === 'disputed').length,
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-b from-white to-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Реестр контрактов
              </h1>
              <p className="text-gray-500">
                Мониторинг государственных строительных контрактов Алматы
              </p>
            </div>
            <div className="flex gap-3">
              {[
                { label: 'Активных', value: counts.active, color: 'text-blue-600' },
                { label: 'Штраф', value: counts.penalized, color: 'text-red-500' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Поиск по названию или подрядчику..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 text-sm"
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
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* District filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-400"
            >
              <option value="all">Все районы</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            Найдено: <span className="text-gray-900 font-medium">{filtered.length}</span> контрактов
          </div>
          <a
            href="/admin"
            className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" />
            </svg>
            Добавить контракт
          </a>
        </div>

        {/* Contract grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-gray-600 font-medium mb-2">Контракты не найдены</div>
            <div className="text-gray-400 text-sm">Попробуйте изменить фильтры поиска</div>
          </div>
        )}
      </div>
    </div>
  )
}
