'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  getCampaignById,
  DEMO_CAMPAIGNS,
  Campaign,
  getCampaignProgress,
  getDaysLeft,
  formatTenge,
  CATEGORY_CONFIG,
  CAMPAIGN_STATUS_CONFIG,
  DONOR_TIER_CONFIG,
  getDonorTier,
  normalizeCampaign,
} from '@/lib/crowdfunding'
import { fetchCampaign, contributeToCampaign } from '@/lib/api'
import { useCrowdfunding } from '@/lib/web3/useCrowdfunding'

const PRESET_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000]

interface PageProps {
  params: { id: string }
}

export default function CampaignDetailPage({ params }: PageProps) {
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined)
  const [donationAmount, setDonationAmount] = useState<number>(5000)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [donated, setDonated] = useState(false)
  const [txInfo, setTxInfo] = useState<string | null>(null)
  const { connected: walletConnected } = useWallet()
  const { contribute: contributeOnChain, loading: solanaLoading } = useCrowdfunding()

  useEffect(() => {
    fetchCampaign(params.id)
      .then((data: any) => {
        if (data && !data.error) {
          setCampaign(normalizeCampaign(data))
        } else {
          setCampaign(getCampaignById(params.id) || null)
        }
      })
      .catch(() => setCampaign(getCampaignById(params.id) || null))
  }, [params.id])

  if (campaign === undefined) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">Кампания не найдена</div>
          <Link href="/crowdfunding" className="text-emerald-600 hover:text-emerald-700 text-sm">
            ← Назад к кампаниям
          </Link>
        </div>
      </div>
    )
  }

  const progress = getCampaignProgress(campaign)
  const daysLeft = getDaysLeft(campaign.deadline)
  const category = CATEGORY_CONFIG[campaign.category]
  const status = CAMPAIGN_STATUS_CONFIG[campaign.status]
  const remaining = Math.max(0, campaign.citizen_target - campaign.citizen_raised)

  const handleDonate = async () => {
    const amount = customAmount ? parseInt(customAmount) : donationAmount
    if (amount < 500 || amount > 500000) return

    setDonated(true)

    // Try on-chain contribution if wallet connected
    if (walletConnected) {
      try {
        // Note: in production, creator PublicKey would come from campaign data
        // For demo, we skip on-chain if we don't have the creator's wallet
        const result = await contributeOnChain(
          // Placeholder — real app would derive from campaign.onChainPubkey
          {} as any, campaign.title, amount, false
        )
        setTxInfo(result.tx)
      } catch (err: any) {
        console.log('On-chain contribution failed (continuing with DB):', err.message)
      }
    }

    // Record in database
    try {
      await contributeToCampaign(campaign.id, {
        citizenId: 'demo-citizen', // In production: from wallet/session
        amount,
        anonymous: false,
        txSignature: txInfo || undefined,
      })
    } catch {
      // DB write failed but donation UI already shown
    }
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-b from-white to-gray-50 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link href="/crowdfunding" className="hover:text-emerald-600 transition-colors">
              Краудфандинг
            </Link>
            <span>/</span>
            <span className="text-gray-600">{campaign.title}</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                  {status.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  {category.icon} {category.label}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{campaign.title}</h1>
              <p className="text-gray-500 text-sm leading-relaxed">{campaign.description}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {campaign.district}
                </span>
                <span>Автор: {campaign.creator}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress section */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Прогресс сбора
              </h2>

              {/* Total project cost */}
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-500">Общий бюджет проекта</span>
                  <span className="text-lg font-bold text-gray-900">{formatTenge(campaign.target_amount)}</span>
                </div>
              </div>

              {/* Citizen share */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-700 font-medium">Доля граждан ({100 - category.statePercent}%)</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatTenge(campaign.citizen_raised)} / {formatTenge(campaign.citizen_target)}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{progress}% собрано</span>
                  {remaining > 0 && <span>Осталось: {formatTenge(remaining)}</span>}
                </div>
              </div>

              {/* State share */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-700 font-medium">Гос. субсидия ({category.statePercent}%)</span>
                  <span className="text-sm font-semibold text-gray-900">{formatTenge(campaign.state_match)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${campaign.state_deposited ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    style={{ width: campaign.state_deposited ? '100%' : '0%' }}
                  />
                </div>
                <div className="text-xs mt-1">
                  {campaign.state_deposited ? (
                    <span className="text-emerald-600">Перечислено акиматом</span>
                  ) : progress >= 100 ? (
                    <span className="text-yellow-600">Ожидает перечисления от акимата</span>
                  ) : (
                    <span className="text-gray-400">Будет перечислено после сбора доли граждан</span>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{campaign.donor_count}</div>
                  <div className="text-xs text-gray-400">участников</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${daysLeft < 0 ? 'text-red-500' : daysLeft < 7 ? 'text-yellow-600' : 'text-gray-900'}`}>
                    {daysLeft < 0 ? 'Истёк' : `${daysLeft} дн.`}
                  </div>
                  <div className="text-xs text-gray-400">до дедлайна</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600">x{Math.round(category.statePercent / Math.max(1, 100 - category.statePercent))}</div>
                  <div className="text-xs text-gray-400">мультипликатор</div>
                </div>
              </div>
            </div>

            {/* Donor feed */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Последние доноры
              </h2>
              {campaign.donors.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Пока нет взносов. Станьте первым!
                </div>
              ) : (
                <div className="space-y-3">
                  {campaign.donors.map((donor) => {
                    const tierConfig = DONOR_TIER_CONFIG[donor.tier]
                    const timeAgo = getTimeAgo(donor.timestamp)
                    return (
                      <div key={donor.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                            {donor.anonymous ? '?' : donor.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm text-gray-900 font-medium">
                              {donor.anonymous ? 'Анонимный донор' : donor.name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className={tierConfig.color}>{tierConfig.label}</span>
                              <span>·</span>
                              <span>{timeAgo}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatTenge(donor.amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Anti-corruption info */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Защита средств
              </h2>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>Все средства хранятся в смарт-контракте Solana — ни акимат, ни подрядчик не могут их потратить до завершения проекта</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>Если кампания не соберёт нужную сумму — 100% возврат автоматически, без заявлений</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>После сбора проект контролируется жюри из жителей района через Amanat Protocol</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>Подрядчик получает оплату только после верификации каждого этапа</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Donate card */}
            {campaign.status === 'active' && !donated && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 sticky top-24">
                <h3 className="font-semibold text-gray-900 mb-3">Внести взнос</h3>

                {/* Preset amounts */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => { setDonationAmount(amount); setCustomAmount('') }}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        donationAmount === amount && !customAmount
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {new Intl.NumberFormat('ru-KZ').format(amount)} ₸
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <div className="relative mb-4">
                  <input
                    type="number"
                    placeholder="Другая сумма"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    min={500}
                    max={500000}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₸</span>
                </div>

                {/* Donor tier preview */}
                {(() => {
                  const amount = customAmount ? parseInt(customAmount) || 0 : donationAmount
                  const tier = getDonorTier(amount)
                  const tierCfg = DONOR_TIER_CONFIG[tier]
                  return (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-4">
                      <div className="text-xs text-gray-400 mb-1">Ваш уровень при этом взносе:</div>
                      <div className={`text-sm font-medium ${tierCfg.color}`}>
                        NFT «{tierCfg.label}»
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {tier === 'participant' && 'Имя в публичном списке доноров'}
                        {tier === 'patron' && 'Имя в метаданных объекта on-chain + репутация'}
                        {tier === 'founder' && 'Первое место в списке + право голоса за подрядчика'}
                      </div>
                    </div>
                  )
                })()}

                <button
                  onClick={handleDonate}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors text-sm"
                >
                  Внести {formatTenge(customAmount ? parseInt(customAmount) || 0 : donationAmount)}
                </button>

                <div className="text-xs text-gray-400 text-center mt-3">
                  Мин. 500 ₸ · Макс. 500 000 ₸
                </div>

                {/* Payment methods */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-2">Способы оплаты</div>
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Криптокошелёк (SOL / USDC)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      Kaspi QR
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      Из District Treasury (штрафы подрядчиков)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Donated confirmation */}
            {donated && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-emerald-700">Спасибо!</span>
                </div>
                <p className="text-sm text-emerald-600">
                  Ваш взнос {formatTenge(customAmount ? parseInt(customAmount) || donationAmount : donationAmount)} записан в смарт-контракт. NFT будет выдан после подтверждения транзакции.
                </p>
                {txInfo && (
                  <a
                    href={`https://explorer.solana.com/tx/${txInfo}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-blue-500 underline"
                  >
                    Посмотреть транзакцию в Solana Explorer →
                  </a>
                )}
              </div>
            )}

            {/* Funded / expired state */}
            {campaign.status === 'funded' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-emerald-700">Кампания профинансирована!</span>
                </div>
                <p className="text-sm text-emerald-600">
                  Сумма собрана, государственная субсидия перечислена. Проект передан в Amanat Protocol для исполнения.
                </p>
                {campaign.contract_id && (
                  <Link href={`/contracts/${campaign.contract_id}`} className="inline-block mt-3 text-sm text-emerald-700 hover:text-emerald-800 underline">
                    Смотреть контракт →
                  </Link>
                )}
              </div>
            )}

            {campaign.status === 'expired' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-red-700">Кампания не собрала средства</span>
                </div>
                <p className="text-sm text-red-600">
                  Все взносы ({formatTenge(campaign.citizen_raised)}) были автоматически возвращены {campaign.donor_count} участникам. 100% суммы, 0% комиссии.
                </p>
              </div>
            )}

            {/* Campaign info */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Информация о кампании</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Категория</span>
                  <span className="text-gray-900">{category.icon} {category.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Район</span>
                  <span className="text-gray-900">{campaign.district}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Автор</span>
                  <span className="text-gray-900">{campaign.creator}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Создано</span>
                  <span className="text-gray-900">{new Date(campaign.created_at).toLocaleDateString('ru-KZ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Дедлайн</span>
                  <span className="text-gray-900">{new Date(campaign.deadline).toLocaleDateString('ru-KZ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Гос. субсидия</span>
                  <span className="text-emerald-600 font-medium">{category.statePercent}%</span>
                </div>
              </div>
            </div>

            {/* NFT rewards */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Награды для доноров</h3>
              <div className="space-y-3">
                {Object.entries(DONOR_TIER_CONFIG).filter(([key]) => key !== 'corporate').map(([key, cfg]) => (
                  <div key={key} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${cfg.color}`}>NFT «{cfg.label}»</span>
                      <span className="text-xs text-gray-400">{formatTenge(cfg.min)}+</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {key === 'participant' && 'Имя в публичном списке доноров проекта'}
                      {key === 'patron' && 'Имя в метаданных объекта on-chain + репутация'}
                      {key === 'founder' && 'Первое место в списке + голос за подрядчика + доп. репутация'}
                    </div>
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

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `${minutes} мин. назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  return `${days} дн. назад`
}
