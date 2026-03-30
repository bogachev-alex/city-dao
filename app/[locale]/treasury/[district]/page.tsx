'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import TreasuryDashboard from '@/components/TreasuryDashboard'
import { DISTRICTS } from '@/lib/contracts'
import { useRedirectContractorFromCitizenEconomyPages } from '@/lib/contractorCitizenRoutes'

export default function TreasuryPage() {
  const params = useParams<{ district: string }>()
  const t = useTranslations('treasury')
  const district = decodeURIComponent(params.district)
  const { holdUi } = useRedirectContractorFromCitizenEconomyPages()

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">{t('districtTreasury')}</div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{district} {t('district')}</h1>
              <p className="text-gray-500 dark:text-gray-400">{t('transparentManagement')}</p>
            </div>
            {/* District switcher */}
            <div className="flex flex-wrap gap-2">
              {DISTRICTS.slice(0, 4).map((d) => (
                <Link
                  key={d}
                  href={`/treasury/${encodeURIComponent(d)}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    d === district
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {d}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <TreasuryDashboard district={district} />
      </div>
    </div>
  )
}
