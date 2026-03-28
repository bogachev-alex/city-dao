'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  DEMO_CAMPAIGNS,
  Campaign,
  formatTenge,
  getCampaignProgress,
  getDaysLeft,
  CAMPAIGN_STATUS_CONFIG,
  CATEGORY_CONFIG,
  DONOR_TIER_CONFIG,
  DonorTier,
  normalizeCampaign,
} from '../../../lib/crowdfunding'
import { fetchCampaigns } from '../../../lib/api'

// Mock: user has donated to campaigns cf-1, cf-3, cf-5
const MY_DONATIONS = [
  { campaignId: 'cf-1', amount: 15000, date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), tier: 'patron' as DonorTier },
  { campaignId: 'cf-3', amount: 50000, date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), tier: 'founder' as DonorTier },
  { campaignId: 'cf-5', amount: 3000, date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), tier: 'participant' as DonorTier },
]

type TabId = 'donations' | 'created'

export default function MyCrowdfundingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('donations')
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>(DEMO_CAMPAIGNS)

  useEffect(() => {
    fetchCampaigns()
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setAllCampaigns(data.map(normalizeCampaign))
        }
      })
      .catch(() => {})
  }, [])

  const MY_CREATED = allCampaigns.slice(0, 1) // Demo: first campaign is "mine"

  const totalDonated = MY_DONATIONS.reduce((sum, d) => sum + d.amount, 0)
  const activeDonations = MY_DONATIONS.filter((d) => {
    const c = allCampaigns.find((c) => c.id === d.campaignId)
    return c && c.status === 'active'
  })
  const nftCount = MY_DONATIONS.length

  const tabs: { id: TabId; label: string }[] = [
    { id: 'donations', label: 'Мои взносы' },
    { id: 'created', label: 'Мои кампании' },
  ]

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-b from-white to-gray-50 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link href="/crowdfunding" className="hover:text-emerald-600 transition-colors">
              Краудфандинг
            </Link>
            <span>/</span>
            <span className="text-gray-600">Мои участия</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Мои участия</h1>
          <p className="text-gray-500 text-sm">Ваши взносы, NFT-награды и созданные кампании</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5">
            <div className="text-sm text-emerald-600 mb-1">Всего внесено</div>
            <div className="text-2xl font-bold text-gray-900">{formatTenge(totalDonated)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-sm text-gray-500 mb-1">Проектов поддержано</div>
            <div className="text-2xl font-bold text-gray-900">{MY_DONATIONS.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-sm text-gray-500 mb-1">Активных кампаний</div>
            <div className="text-2xl font-bold text-blue-600">{activeDonations.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-sm text-gray-500 mb-1">NFT получено</div>
            <div className="text-2xl font-bold text-amber-600">{nftCount}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Donations tab */}
        {activeTab === 'donations' && (
          <div className="space-y-3">
            {MY_DONATIONS.map((donation) => {
              const campaign = allCampaigns.find((c) => c.id === donation.campaignId)
              if (!campaign) return null
              const progress = getCampaignProgress(campaign)
              const status = CAMPAIGN_STATUS_CONFIG[campaign.status]
              const tierConfig = DONOR_TIER_CONFIG[donation.tier]
              const category = CATEGORY_CONFIG[campaign.category]
              const daysLeft = getDaysLeft(campaign.deadline)

              return (
                <Link key={donation.campaignId} href={`/crowdfunding/${campaign.id}`}>
                  <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-md transition-all duration-200 cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                            {status.label}
                          </span>
                          <span className="text-xs text-gray-400">{category.icon} {category.label}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm mb-1">{campaign.title}</h3>
                        <div className="text-xs text-gray-400">{campaign.district}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-gray-900">{formatTenge(donation.amount)}</div>
                        <div className={`text-xs ${tierConfig.color}`}>NFT «{tierConfig.label}»</div>
                        <div className="text-xs text-gray-400 mt-1">{new Date(donation.date).toLocaleDateString('ru-KZ')}</div>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{formatTenge(campaign.citizen_raised)} / {formatTenge(campaign.citizen_target)}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Refund notice for expired */}
                    {campaign.status === 'expired' && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Средства возвращены на кошелёк
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Created campaigns tab */}
        {activeTab === 'created' && (
          <div className="space-y-3">
            {MY_CREATED.map((campaign) => {
              const progress = getCampaignProgress(campaign)
              const status = CAMPAIGN_STATUS_CONFIG[campaign.status]
              const category = CATEGORY_CONFIG[campaign.category]

              return (
                <Link key={campaign.id} href={`/crowdfunding/${campaign.id}`}>
                  <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-md transition-all duration-200 cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                            {status.label}
                          </span>
                          <span className="text-xs text-gray-400">{category.icon} {category.label}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm mb-1">{campaign.title}</h3>
                        <div className="text-xs text-gray-400">{campaign.district} · {campaign.donor_count} доноров</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-gray-900">{formatTenge(campaign.target_amount)}</div>
                        <div className="text-xs text-gray-400">общий бюджет</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{formatTenge(campaign.citizen_raised)} / {formatTenge(campaign.citizen_target)}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}

            <Link href="/crowdfunding/new">
              <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-400 transition-colors cursor-pointer">
                <svg width="24" height="24" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24" className="mx-auto mb-2">
                  <path d="M12 4v16m8-8H4" />
                </svg>
                <div className="text-sm text-gray-500">Создать новую кампанию</div>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
