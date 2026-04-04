'use client'

import { useMemo, useState } from 'react'
import { Link } from '@/i18n/routing'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  CampaignCategory,
  CATEGORY_CONFIG,
  getCitizenTarget,
  getStateMatch,
  formatTenge,
} from '@/lib/crowdfunding'
import { createCampaign, fetchCitizen } from '@/lib/api'
import { useCrowdfunding } from '@/lib/web3/useCrowdfunding'
import { DISTRICTS } from '@/lib/contracts'
import { useRedirectContractorFromCitizenEconomyPages } from '@/lib/contractorCitizenRoutes'
import {
  CampaignDeadlinePicker,
  combineLocalDateTime,
  defaultDeadlineParts,
  toDateInputValue,
} from '@/components/CampaignDeadlinePicker'

// Category key to Prisma enum
const CATEGORY_ENUM: Record<CampaignCategory, string> = {
  playground: 'PLAYGROUND',
  school: 'SCHOOL',
  roads: 'ROADS',
  landscaping: 'LANDSCAPING',
  commercial: 'COMMERCIAL',
}

export default function NewCampaignPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CampaignCategory>('landscaping')
  const [district, setDistrict] = useState(DISTRICTS[0])
  const [targetAmount, setTargetAmount] = useState<string>('')
  const [deadline, setDeadline] = useState(() => defaultDeadlineParts(30))
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txInfo, setTxInfo] = useState<string | null>(null)
  const { publicKey, connected: walletConnected } = useWallet()
  const { createCampaign: createOnChain } = useCrowdfunding()
  const { holdUi } = useRedirectContractorFromCitizenEconomyPages()

  const totalAmount = parseInt(targetAmount) || 0
  const citizenTarget = getCitizenTarget(totalAmount, category)
  const stateMatch = getStateMatch(totalAmount, category)
  const categoryConfig = CATEGORY_CONFIG[category]

  const deadlineEndsAt = useMemo(
    () => combineLocalDateTime(deadline.date, deadline.time),
    [deadline.date, deadline.time]
  )

  const deadlineOffsetMs =
    deadlineEndsAt !== null ? deadlineEndsAt.getTime() - Date.now() : Number.NaN

  const canSubmit =
    title.length >= 10 &&
    description.length >= 50 &&
    totalAmount >= 100_000 &&
    Number.isFinite(deadlineOffsetMs) &&
    deadlineOffsetMs >= 60_000

  const fillTestData = () => {
    const now = Date.now()
    const suffix = String(now).slice(-4)
    setTitle(`Тестовая кампания #${suffix}: освещение дворов`)
    setDescription(
      'Жители района регулярно жалуются на недостаточное освещение во дворах. ' +
      'Проект предусматривает установку LED-фонарей, подключение к сети и базовое благоустройство территории.'
    )
    setCategory('landscaping')
    setDistrict(DISTRICTS[2] || DISTRICTS[0])
    setTargetAmount('3500000')
    setDeadline(defaultDeadlineParts(45))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)

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
      setError('Сначала зарегистрируйтесь как гражданин')
      return
    }

    if (!walletConnected || !publicKey) {
      setError('Подключите кошелёк: создание краудфандинг-кампании теперь обязательно выполняется on-chain (devnet).')
      return
    }

    if (!deadlineEndsAt) {
      setError('Укажите корректную дату и время дедлайна')
      return
    }

    let onChainPubkey: string
    try {
      const deadlineTimestamp = Math.floor(deadlineEndsAt.getTime() / 1000)
      const result = await createOnChain(
        title, description, district, category,
        totalAmount, deadlineTimestamp,
        43.25, 76.91, // default Almaty coordinates
      )
      setTxInfo(
        result.reusedExisting
          ? 'Кампания с таким названием уже есть on-chain — каталог обновлён тем же адресом.'
          : result.tx
      )
      onChainPubkey = result.pda
    } catch (err: any) {
      setError(`On-chain создание кампании не выполнено: ${err?.message || 'неизвестная ошибка'}`)
      return
    }

    // Save to database
    try {
      await createCampaign({
        title,
        description,
        district,
        category: CATEGORY_ENUM[category],
        targetAmount: totalAmount,
        deadline: deadlineEndsAt.toISOString(),
        creatorId: citizenId,
        onChainPubkey,
      })
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании кампании')
      return
    }

    setSubmitted(true)
  }

  if (holdUi) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Кампания создана!</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Ваша кампания «{title}» опубликована и доступна для взносов. Поделитесь ссылкой с жителями района.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/crowdfunding"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              К кампаниям
            </Link>
            <Link
              href="/crowdfunding/my"
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Мои кампании
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link href="/crowdfunding" className="hover:text-emerald-600 transition-colors">
              Краудфандинг
            </Link>
            <span>/</span>
            <span className="text-gray-600 dark:text-gray-300">Новая кампания</span>
          </div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Создать кампанию</h1>
            <button
              type="button"
              onClick={fillTestData}
              className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors"
            >
              Заполнить тестовыми данными
            </button>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Опишите проект, укажите бюджет — система рассчитает долю граждан и государственную субсидию автоматически.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Основная информация</h2>

            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Название проекта</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Детская площадка во дворе ЖК «Алтын Булак»"
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
              />
              {title.length > 0 && title.length < 10 && (
                <div className="text-xs text-red-500 mt-1">Минимум 10 символов</div>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Описание проблемы и проекта</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Опишите текущую проблему, что именно нужно сделать, кому это поможет..."
                rows={5}
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm resize-none"
              />
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {description.length}/50 символов мин.
                {description.length > 0 && description.length < 50 && (
                  <span className="text-red-500 ml-2">Нужно ещё {50 - description.length}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Категория</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CampaignCategory)}
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                >
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.icon} {cfg.label} (гос. {cfg.statePercent}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Район</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Budget */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Бюджет</h2>

            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Общий бюджет проекта (₸)</label>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="Например: 8500000"
                min={100000}
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
              />
              {totalAmount > 0 && totalAmount < 100000 && (
                <div className="text-xs text-red-500 mt-1">Минимум 100 000 ₸</div>
              )}
            </div>

            {/* Auto-calculated breakdown */}
            {totalAmount >= 100000 && (
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-500/10 dark:to-blue-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-4 space-y-3">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider">Расчёт автоматический</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Доля граждан ({100 - categoryConfig.statePercent}%)</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{formatTenge(citizenTarget)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Гос. субсидия ({categoryConfig.statePercent}%)</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatTenge(stateMatch)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Мультипликатор: каждый тенге гражданина = {categoryConfig.statePercent > 0 ? `${(categoryConfig.statePercent / (100 - categoryConfig.statePercent)).toFixed(0)}x от государства` : 'без субсидии'}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <span className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Дедлайн сбора — календарь и время
                </span>
                <CampaignDeadlinePicker
                  date={deadline.date}
                  time={deadline.time}
                  onDateChange={(date) => setDeadline((d) => ({ ...d, date }))}
                  onTimeChange={(time) => setDeadline((d) => ({ ...d, time }))}
                  minDateStr={toDateInputValue(new Date())}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Время в часовом поясе браузера; в смарт-контракт и БД сохраняется та же метка (UTC).
                </p>
              </div>
              <div>
                <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1.5">Быстро: от сейчас</span>
                <div className="flex flex-wrap gap-2">
                  {[30, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDeadline(defaultDeadlineParts(d))}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-500/40"
                    >
                      +{d} дн.
                    </button>
                  ))}
                </div>
              </div>
              {deadlineEndsAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Выбрано окончание:{' '}
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {deadlineEndsAt.toLocaleString('ru-KZ', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  {Number.isFinite(deadlineOffsetMs) && deadlineOffsetMs < 60_000 && (
                    <span className="text-red-500 block mt-1">Укажите момент не раньше чем через 1 минуту от текущего времени.</span>
                  )}
                  {Number.isFinite(deadlineOffsetMs) && deadlineOffsetMs < 0 && (
                    <span className="text-red-500 block mt-1">Дедлайн в прошлом — выберите будущую дату и время.</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <Link href="/crowdfunding" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              ← Отмена
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                canSubmit
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              Опубликовать кампанию
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
