'use client'

import { Link } from '@/i18n/routing'
import {
  Campaign,
  getCampaignProgress,
  getDaysLeft,
  formatTenge,
  CATEGORY_CONFIG,
  CAMPAIGN_STATUS_CONFIG,
} from '../lib/crowdfunding'

interface CampaignCardProps {
  campaign: Campaign
}

export default function CampaignCard({ campaign }: CampaignCardProps) {
  const progress = getCampaignProgress(campaign)
  const daysLeft = getDaysLeft(campaign.deadline)
  const category = CATEGORY_CONFIG[campaign.category]
  const status = CAMPAIGN_STATUS_CONFIG[campaign.status]
  const statePercent = category.statePercent

  return (
    <Link href={`/crowdfunding/${campaign.id}`}>
      <div className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-md transition-all duration-200 cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-emerald-600 transition-colors line-clamp-2">
            {campaign.title}
          </h3>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Category & district */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span>{category.icon}</span>
            {category.label}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {campaign.district}
          </span>
        </div>

        {/* Amounts */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Собрано гражданами</div>
            <div className="text-gray-900 font-semibold">
              {formatTenge(campaign.citizen_raised)}
              <span className="text-gray-400 font-normal text-xs"> / {formatTenge(campaign.citizen_target)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 mb-0.5">
              {daysLeft < 0 ? 'Истёк' : 'Осталось'}
            </div>
            <div className={`font-medium text-sm ${daysLeft < 0 ? 'text-red-500' : daysLeft < 7 ? 'text-yellow-600' : 'text-gray-500'}`}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)} дн. назад` : `${daysLeft} дн.`}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>{campaign.donor_count} участников</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* State matching badge */}
        {statePercent > 0 && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <svg width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-xs text-emerald-700 font-medium">
              Гос. субсидия {statePercent}% — {formatTenge(campaign.state_match)}
            </span>
          </div>
        )}

        {/* Expired refund badge */}
        {campaign.status === 'expired' && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
            <svg width="14" height="14" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="text-xs text-red-600 font-medium">
              Возврат средств — автоматически
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
