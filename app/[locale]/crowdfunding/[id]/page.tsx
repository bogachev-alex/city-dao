'use client'

import { useState, useEffect, useMemo } from 'react'
import { Link } from '@/i18n/routing'
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
import { fetchCampaign, fetchCitizen, contributeToCampaign, updateCampaignStatus } from '@/lib/api'
import { useCrowdfunding } from '@/lib/web3/useCrowdfunding'
import { PublicKey } from '@solana/web3.js'
import { useRedirectContractorFromCitizenEconomyPages } from '@/lib/contractorCitizenRoutes'
import { getContractDetailHref, getSolanaExplorerTxUrl } from '@/lib/contracts'
import OnChainLink from '@/components/OnChainLink'
import { tengeToLamports } from '@/lib/web3/constants'

const PRESET_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000]

interface PageProps {
  params: { id: string }
}

export default function CampaignDetailPage({ params }: PageProps) {
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined)
  const [donationAmount, setDonationAmount] = useState<number>(5000)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [donated, setDonated] = useState(false)
  const [donateError, setDonateError] = useState<string | null>(null)
  const [txInfo, setTxInfo] = useState<string | null>(null)
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [onChainInfo, setOnChainInfo] = useState<any | null>(null)
  const [onChainInfoError, setOnChainInfoError] = useState<string | null>(null)
  /** First on-chain fetch finished (avoids flashing «опубликовать» while RPC reads account). */
  const [onChainChecked, setOnChainChecked] = useState(false)
  const { publicKey, connected: walletConnected } = useWallet()
  const {
    contribute: contributeOnChain,
    createCampaign: createCampaignOnChain,
    fetchCampaignAccount,
    fetchCampaignAccountByAddress,
    getCampaignPDA,
    loading: solanaLoading,
  } = useCrowdfunding()
  const { holdUi } = useRedirectContractorFromCitizenEconomyPages()

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

  const derivedCampaignPda = useMemo(() => {
    if (!campaign?.creator_wallet || !campaign?.title) return null
    try {
      const [pda] = getCampaignPDA(new PublicKey(campaign.creator_wallet), campaign.title)
      return pda.toBase58()
    } catch {
      return null
    }
  }, [campaign?.creator_wallet, campaign?.title, getCampaignPDA])

  const displayOnChainAddress = campaign?.onChainPubkey || derivedCampaignPda

  useEffect(() => {
    let cancelled = false
    const loadOnChain = async () => {
      if (!campaign?.title) {
        if (!cancelled) {
          setOnChainInfo(null)
          setOnChainInfoError(null)
          setOnChainChecked(true)
        }
        return
      }
      if (!cancelled) setOnChainChecked(false)

      try {
        // 1. Prefer direct fetch by saved onChainPubkey (no PDA derivation needed)
        if (campaign.onChainPubkey) {
          const account = await fetchCampaignAccountByAddress(campaign.onChainPubkey)
          if (!cancelled) {
            setOnChainInfo(account)
            setOnChainInfoError(null)
          }
          return
        }

        // 2. Try deriving PDA from creator_wallet + title
        let account: any = null
        if (campaign.creator_wallet) {
          try {
            const creator = new PublicKey(campaign.creator_wallet)
            account = await fetchCampaignAccount(creator, campaign.title)
          } catch {
            // invalid creator_wallet, try connected wallet below
          }
        }

        // 3. Fallback: derive PDA from connected wallet + title
        if (!account && publicKey) {
          try {
            account = await fetchCampaignAccount(publicKey, campaign.title)
          } catch {
            // connected wallet doesn't match any on-chain campaign
          }
        }

        if (!cancelled) {
          setOnChainInfo(account)
          setOnChainInfoError(null)
        }
      } catch {
        if (!cancelled) {
          setOnChainInfo(null)
          setOnChainInfoError(null)
        }
      } finally {
        if (!cancelled) setOnChainChecked(true)
      }
    }
    loadOnChain()
    return () => {
      cancelled = true
    }
  }, [campaign?.creator_wallet, campaign?.title, campaign?.onChainPubkey, publicKey, fetchCampaignAccount, fetchCampaignAccountByAddress])

  if (holdUi) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (campaign === undefined) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 dark:text-gray-500 text-lg mb-2">Кампания не найдена</div>
          <Link href="/crowdfunding" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 text-sm">
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
    setDonateError(null)

    // Look up citizen by wallet
    let citizenId: string | undefined
    if (publicKey) {
      try {
        const citizen = await fetchCitizen(publicKey.toBase58())
        citizenId = citizen?.id
      } catch {
        // citizen not found
      }
    }
    if (!citizenId) {
      setDonateError('Сначала зарегистрируйтесь как гражданин')
      return
    }

    if (!walletConnected) {
      setDonateError('Подключите кошелёк для взноса')
      return
    }

    setDonated(false)
    setDonateError(null)

    let onChainTx: string | undefined

    if (walletConnected) {
      try {
        let creatorPK: PublicKey

        if (onChainInfo?.creator) {
          creatorPK = new PublicKey(onChainInfo.creator)
        } else if (campaign.creator_wallet) {
          try {
            creatorPK = new PublicKey(campaign.creator_wallet)
          } catch {
            setDonateError('Некорректный кошелёк автора кампании. Попробуйте обновить страницу.')
            setDonated(false)
            return
          }
        } else {
          setDonateError('Кампания не опубликована on-chain')
          setDonated(false)
          return
        }

        const lamports = tengeToLamports(amount)
        const result = await contributeOnChain(creatorPK, campaign.title, amount, lamports, false)
        onChainTx = result.tx
        setTxInfo(result.tx)
      } catch (err: any) {
        setDonateError(err?.message || 'Ошибка on-chain взноса')
        setDonated(false)
        return
      }
    }

    // Record in database
    try {
      await contributeToCampaign(campaign.id, {
        citizenId,
        amount,
        anonymous: false,
        txSignature: onChainTx,
      })
      setDonated(true)
    } catch (err: any) {
      console.warn('DB contribution failed:', err.message)
      if (!onChainTx) {
        setDonateError('Ошибка записи взноса в БД')
        setDonated(false)
      } else {
        setDonated(true)
      }
    }
  }

  const handlePublishOnChain = async () => {
    if (!campaign) return
    if (!walletConnected || !publicKey) {
      setPublishError('Подключите кошелёк для публикации в on-chain.')
      return
    }
    setPublishLoading(true)
    setPublishError(null)

    const seedTitle = campaign.title.length > 32 ? campaign.title.slice(0, 32) : campaign.title
    const [pda] = getCampaignPDA(publicKey, seedTitle)
    const pdaStr = pda.toBase58()

    try {
      const deadlineTs = Math.floor(new Date(campaign.deadline).getTime() / 1000)
      const result = await createCampaignOnChain(
        campaign.title,
        campaign.description,
        campaign.district,
        campaign.category,
        campaign.target_amount,
        deadlineTs,
        campaign.lat,
        campaign.lng,
      )
      await updateCampaignStatus(campaign.id, 'set_onchain', { onChainPubkey: result.pda })
      setCampaign((prev) => (prev ? { ...prev, onChainPubkey: result.pda } : prev))
      try {
        const account = await fetchCampaignAccount(publicKey, campaign.title)
        setOnChainInfo(account)
      } catch {
        // ignore transient fetch errors after publish
      }
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('already in use') || msg.includes('custom program error: 0x0')) {
        try {
          await updateCampaignStatus(campaign.id, 'set_onchain', { onChainPubkey: pdaStr })
          setCampaign((prev) => (prev ? { ...prev, onChainPubkey: pdaStr } : prev))
          const account = await fetchCampaignAccountByAddress(pdaStr)
          setOnChainInfo(account)
        } catch {
          setPublishError('Аккаунт уже существует on-chain, но не удалось прочитать данные.')
        }
      } else {
        setPublishError(msg || 'Не удалось опубликовать кампанию в on-chain.')
      }
    } finally {
      setPublishLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link href="/crowdfunding" className="hover:text-emerald-600 transition-colors">
              Краудфандинг
            </Link>
            <span>/</span>
            <span className="text-gray-600 dark:text-gray-300">{campaign.title}</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                  {status.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  {category.icon} {category.label}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{campaign.title}</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{campaign.description}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
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
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Прогресс сбора
              </h2>

              {/* Total project cost */}
              <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Общий бюджет проекта</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{formatTenge(campaign.target_amount)}</span>
                </div>
              </div>

              {/* Citizen share */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Доля граждан ({100 - category.statePercent}%)</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatTenge(campaign.citizen_raised)} / {formatTenge(campaign.citizen_target)}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                  <span>{progress}% собрано</span>
                  {remaining > 0 && <span>Осталось: {formatTenge(remaining)}</span>}
                </div>
              </div>

              {/* State share */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Гос. субсидия ({category.statePercent}%)</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatTenge(campaign.state_match)}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${campaign.state_deposited ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    style={{ width: campaign.state_deposited ? '100%' : '0%' }}
                  />
                </div>
                <div className="text-xs mt-1">
                  {campaign.state_deposited ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Перечислено акиматом</span>
                  ) : progress >= 100 ? (
                    <span className="text-yellow-600 dark:text-yellow-400">Ожидает перечисления от акимата</span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">Будет перечислено после сбора доли граждан</span>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{campaign.donor_count}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">участников</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${daysLeft < 0 ? 'text-red-500' : daysLeft < 7 ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>
                    {daysLeft < 0 ? 'Истёк' : `${daysLeft} дн.`}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">до дедлайна</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">x{Math.round(category.statePercent / Math.max(1, 100 - category.statePercent))}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">мультипликатор</div>
                </div>
              </div>
            </div>

            {/* Donor feed */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Последние доноры
              </h2>
              {campaign.donors.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                  Пока нет взносов. Станьте первым!
                </div>
              ) : (
                <div className="space-y-3">
                  {campaign.donors.map((donor) => {
                    const tierConfig = DONOR_TIER_CONFIG[donor.tier]
                    const timeAgo = getTimeAgo(donor.timestamp)
                    return (
                      <div key={donor.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400">
                            {donor.anonymous ? '?' : donor.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm text-gray-900 dark:text-white font-medium">
                              {donor.anonymous ? 'Анонимный донор' : donor.name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                              <span className={tierConfig.color}>{tierConfig.label}</span>
                              <span>·</span>
                              <span>{timeAgo}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatTenge(donor.amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Anti-corruption info */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Защита средств
              </h2>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
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
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 sticky top-24">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Внести взнос</h3>

                {/* Preset amounts */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => { setDonationAmount(amount); setCustomAmount('') }}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        donationAmount === amount && !customAmount
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
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
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">₸</span>
                </div>

                {/* Donor tier preview */}
                {(() => {
                  const amount = customAmount ? parseInt(customAmount) || 0 : donationAmount
                  const tier = getDonorTier(amount)
                  const tierCfg = DONOR_TIER_CONFIG[tier]
                  return (
                    <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-lg p-3 mb-4">
                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Ваш уровень при этом взносе:</div>
                      <div className={`text-sm font-medium ${tierCfg.color}`}>
                        NFT «{tierCfg.label}»
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
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

                {donateError && (
                  <div className="text-xs text-red-500 text-center mt-2">{donateError}</div>
                )}

                <div className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
                  Мин. 500 ₸ · Макс. 500 000 ₸
                </div>

                {/* Payment methods */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">Способы оплаты</div>
                  <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
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
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Спасибо!</span>
                </div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Ваш взнос {formatTenge(customAmount ? parseInt(customAmount) || donationAmount : donationAmount)} записан в смарт-контракт. NFT будет выдан после подтверждения транзакции.
                </p>
                {txInfo && (
                  <a
                    href={getSolanaExplorerTxUrl(txInfo)}
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
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Кампания профинансирована!</span>
                </div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Сумма собрана, государственная субсидия перечислена. Проект передан в Amanat Protocol для исполнения.
                </p>
                {campaign.contract_id && (
                  <Link href={getContractDetailHref(campaign.contract_id)} className="inline-block mt-3 text-sm text-emerald-700 hover:text-emerald-800 underline">
                    Смотреть контракт →
                  </Link>
                )}
              </div>
            )}

            {campaign.status === 'expired' && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-red-700 dark:text-red-400">Кампания не собрала средства</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Все взносы ({formatTenge(campaign.citizen_raised)}) были автоматически возвращены {campaign.donor_count} участникам. 100% суммы, 0% комиссии.
                </p>
              </div>
            )}

            {/* Campaign info */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Информация о кампании</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500">Категория</span>
                  <span className="text-gray-900 dark:text-white">{category.icon} {category.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500">Район</span>
                  <span className="text-gray-900 dark:text-white">{campaign.district}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500">Автор</span>
                  <span className="text-gray-900 dark:text-white">{campaign.creator}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500">Создано</span>
                  <span className="text-gray-900 dark:text-white">{new Date(campaign.created_at).toLocaleDateString('ru-KZ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500">Дедлайн</span>
                  <span className="text-gray-900 dark:text-white">{new Date(campaign.deadline).toLocaleDateString('ru-KZ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500">Гос. субсидия</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{category.statePercent}%</span>
                </div>
              </div>
            </div>

            {/* On-chain status: DB onChainPubkey OR live account read from devnet (PDA match) */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Статус в блокчейне</h3>
              {!onChainChecked ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Проверка on-chain…</div>
              ) : campaign.onChainPubkey || onChainInfo ? (
                <div className="space-y-2 text-sm">
                  {displayOnChainAddress && (
                    <div className="flex justify-between">
                      <span className="text-gray-400 dark:text-gray-500">On-chain адрес</span>
                      <OnChainLink
                        address={displayOnChainAddress}
                        label={`${displayOnChainAddress.slice(0, 6)}...${displayOnChainAddress.slice(-6)}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                      />
                    </div>
                  )}
                  {onChainInfo && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500">On-chain собрано</span>
                        <span className="text-gray-900 dark:text-white">
                          {formatTenge(Number(onChainInfo.citizenRaised ?? onChainInfo.citizen_raised ?? 0))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500">On-chain цель граждан</span>
                        <span className="text-gray-900 dark:text-white">
                          {formatTenge(Number(onChainInfo.citizenTarget ?? onChainInfo.citizen_target ?? 0))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500">On-chain доноров</span>
                        <span className="text-gray-900 dark:text-white">
                          {Number(onChainInfo.donorCount ?? onChainInfo.donor_count ?? 0)}
                        </span>
                      </div>
                    </>
                  )}
                  {onChainInfoError && <div className="text-xs text-yellow-600 dark:text-yellow-400">{onChainInfoError}</div>}
                  {!campaign.onChainPubkey && onChainInfo && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Аккаунт найден в сети; при необходимости сохраните PDA в БД (поле onChainPubkey).
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Кампания пока не опубликована в on-chain.</div>
                  <button
                    onClick={handlePublishOnChain}
                    disabled={publishLoading || solanaLoading}
                    className="px-3 py-2 rounded-lg text-xs font-medium border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-60"
                  >
                    {publishLoading || solanaLoading ? 'Публикация в on-chain...' : 'Добавить в on-chain'}
                  </button>
                  {publishError && <div className="text-xs text-red-500">{publishError}</div>}
                </div>
              )}
            </div>

            {/* NFT rewards */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Награды для доноров</h3>
              <div className="space-y-3">
                {Object.entries(DONOR_TIER_CONFIG).filter(([key]) => key !== 'corporate').map(([key, cfg]) => (
                  <div key={key} className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${cfg.color}`}>NFT «{cfg.label}»</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatTenge(cfg.min)}+</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
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
