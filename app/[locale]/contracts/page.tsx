'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  DEMO_CONTRACTS,
  DISTRICTS,
  Contract,
  ContractStatus,
  normalizeContract,
  GOSZAKUP_ALMATY_WORKS_MIN10M_URL,
} from '@/lib/contracts'
import { fetchContracts } from '@/lib/api'
import ContractCard from '@/components/ContractCard'
import { Link } from '@/i18n/routing'
import { useAuth } from '@/components/AuthContext'

const STATUS_API: Record<ContractStatus, string> = {
  active: 'ACTIVE',
  penalized: 'PENALIZED',
  completed: 'COMPLETED',
  disputed: 'DISPUTED',
}

export default function ContractsPage() {
  const t = useTranslations('contracts')
  const { user } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all')
  const [districtFilter, setDistrictFilter] = useState<string>('all')
  const [customerFilter, setCustomerFilter] = useState('')
  const [subjectTypeFilter, setSubjectTypeFilter] = useState<string>('all')
  const [amountMinFilter, setAmountMinFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [contractorScope, setContractorScope] = useState<'mine' | 'all'>('mine')

  const isContractor = user?.role === 'CONTRACTOR'
  const contractorNameNorm = user?.name?.trim().toLowerCase() ?? ''

  useEffect(() => {
    if (user?.role !== 'CONTRACTOR') setContractorScope('mine')
  }, [user?.role])

  const STATUS_FILTERS: { value: ContractStatus | 'all'; label: string }[] = [
    { value: 'all', label: t('all') },
    { value: 'active', label: t('activeFilter') },
    { value: 'penalized', label: t('penalizedFilter') },
    { value: 'completed', label: t('completedFilter') },
    { value: 'disputed', label: t('disputedFilter') },
  ]

  const loadContracts = useCallback(() => {
    setLoading(true)
    const amountMin = amountMinFilter.trim() ? Number(amountMinFilter.replace(/\s/g, '')) : undefined
    fetchContracts({
      district: districtFilter !== 'all' ? districtFilter : undefined,
      status: statusFilter !== 'all' ? STATUS_API[statusFilter] : undefined,
      customer: customerFilter.trim() || undefined,
      subjectType: subjectTypeFilter !== 'all' ? subjectTypeFilter : undefined,
      amountMin: amountMin != null && !Number.isNaN(amountMin) ? amountMin : undefined,
    })
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setContracts(data.map(normalizeContract))
        } else {
          setContracts(DEMO_CONTRACTS)
        }
      })
      .catch(() => setContracts(DEMO_CONTRACTS))
      .finally(() => setLoading(false))
  }, [districtFilter, statusFilter, customerFilter, subjectTypeFilter, amountMinFilter])

  useEffect(() => {
    loadContracts()
  }, [loadContracts])

  const filtered = contracts.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const inTitle = c.title.toLowerCase().includes(q)
      const inContractor = c.contractor.toLowerCase().includes(q)
      const inCustomer = (c.customerName || '').toLowerCase().includes(q)
      const inRegistry = (c.registryNumber || '').toLowerCase().includes(q)
      if (!inTitle && !inContractor && !inCustomer && !inRegistry) return false
    }
    return true
  })

  const filteredForDisplay = useMemo(() => {
    if (!isContractor || contractorScope === 'all') return filtered
    return filtered.filter((c) => c.contractor.trim().toLowerCase() === contractorNameNorm)
  }, [filtered, isContractor, contractorScope, contractorNameNorm])

  const contractsForStats = useMemo(() => {
    if (isContractor && contractorScope === 'mine') {
      return contracts.filter((c) => c.contractor.trim().toLowerCase() === contractorNameNorm)
    }
    return contracts
  }, [contracts, isContractor, contractorScope, contractorNameNorm])

  const applyGoszakupPreset = () => {
    setCustomerFilter('Алматы')
    setSubjectTypeFilter('Работа')
    setAmountMinFilter('10000000')
  }

  const counts = {
    active: contractsForStats.filter((c) => c.status === 'active').length,
    penalized: contractsForStats.filter((c) => c.status === 'penalized').length,
    completed: contractsForStats.filter((c) => c.status === 'completed').length,
    disputed: contractsForStats.filter((c) => c.status === 'disputed').length,
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {t('title')}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 max-w-2xl">
                {t('subtitle')}
              </p>
              <a
                href={GOSZAKUP_ALMATY_WORKS_MIN10M_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {t('goszakupReference')}
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
            </div>
            <div className="flex gap-3">
              {[
                { label: t('active'), value: counts.active, color: 'text-blue-600 dark:text-blue-400' },
                { label: t('penalty'), value: counts.penalized, color: 'text-red-500 dark:text-red-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {isContractor && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-0.5">
              <button
                type="button"
                onClick={() => setContractorScope('mine')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  contractorScope === 'mine'
                    ? 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {t('contractorScopeMine')}
              </button>
              <button
                type="button"
                onClick={() => setContractorScope('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  contractorScope === 'all'
                    ? 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {t('contractorScopeAll')}
              </button>
            </div>
            <Link
              href="/contractor"
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {t('contractorDeskLink')} →
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t('customerFilter')}</label>
              <input
                type="text"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                placeholder={t('customerPlaceholder')}
                className="w-full min-w-[180px] sm:w-52 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t('subjectTypeFilter')}</label>
              <select
                value={subjectTypeFilter}
                onChange={(e) => setSubjectTypeFilter(e.target.value)}
                className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
              >
                <option value="all">{t('allSubjectTypes')}</option>
                <option value="Работа">{t('subjectWork')}</option>
                <option value="Товар">{t('subjectGoods')}</option>
                <option value="Услуга">{t('subjectServices')}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t('amountFromFilter')}</label>
              <input
                type="text"
                inputMode="numeric"
                value={amountMinFilter}
                onChange={(e) => setAmountMinFilter(e.target.value)}
                placeholder="10000000"
                className="w-full min-w-[140px] sm:w-36 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
              />
            </div>
            <button
              type="button"
              onClick={applyGoszakupPreset}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 transition-colors"
            >
              {t('goszakupPreset')}
            </button>
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
                      : 'bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
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
              className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
            >
              <option value="all">{t('allDistricts')}</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('found')}{' '}
            <span className="text-gray-900 dark:text-white font-medium">{filteredForDisplay.length}</span>{' '}
            {t('contractsCount')}
          </div>
          {user?.role === 'AKIMAT' && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:text-emerald-400 transition-colors"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
              {t('addContract')}
            </Link>
          )}
        </div>

        {/* Contract grid */}
        {filteredForDisplay.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredForDisplay.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-gray-600 dark:text-gray-400 font-medium mb-2">{t('notFound')}</div>
            {isContractor && contractorScope === 'mine' && filtered.length > 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm max-w-md mx-auto mb-3">{t('contractorMineEmpty')}</p>
            ) : null}
            <div className="text-gray-400 dark:text-gray-500 text-sm">{t('tryChangeFilters')}</div>
          </div>
        )}
      </div>
    </div>
  )
}
