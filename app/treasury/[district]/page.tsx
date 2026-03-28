'use client'

import Link from 'next/link'
import TreasuryDashboard from '../../../components/TreasuryDashboard'
import { DISTRICTS } from '../../../lib/contracts'

interface PageProps {
  params: { district: string }
}

export default function TreasuryPage({ params }: PageProps) {
  const district = decodeURIComponent(params.district)

  return (
    <div className="min-h-screen pt-16 bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Районная казна</div>
              <h1 className="text-3xl font-bold text-white mb-2">{district} район</h1>
              <p className="text-gray-400">Прозрачное управление бюджетом через децентрализованное голосование</p>
            </div>
            {/* District switcher */}
            <div className="flex flex-wrap gap-2">
              {DISTRICTS.slice(0, 4).map((d) => (
                <Link
                  key={d}
                  href={`/treasury/${encodeURIComponent(d)}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    d === district
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
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
