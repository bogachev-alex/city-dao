export type CampaignStatus = 'active' | 'funded' | 'in_progress' | 'completed' | 'expired'
export type CampaignCategory = 'playground' | 'roads' | 'landscaping' | 'school' | 'commercial'
export type DonorTier = 'participant' | 'patron' | 'founder' | 'corporate'

export interface CampaignDonor {
  id: string
  name: string
  amount: number
  timestamp: string
  tier: DonorTier
  anonymous: boolean
}

export interface Campaign {
  id: string
  title: string
  description: string
  district: string
  category: CampaignCategory
  status: CampaignStatus
  target_amount: number       // total project cost (tenge)
  citizen_target: number      // citizen share (tenge)
  state_match: number         // state subsidy (tenge)
  citizen_raised: number      // amount raised by citizens so far
  state_deposited: boolean    // whether akimat deposited their share
  donor_count: number
  deadline: string
  created_at: string
  creator: string
  creator_wallet: string
  creator_tier: string
  lat: number
  lng: number
  photo_url?: string
  donors: CampaignDonor[]
  contract_id?: string        // linked contract after funding
  onChainPubkey?: string | null
}

// Matching ratios by category: state pays this percentage, citizens pay the rest
export const CATEGORY_CONFIG: Record<CampaignCategory, { label: string; statePercent: number; icon: string }> = {
  playground: { label: 'Детские площадки', statePercent: 90, icon: '🏗️' },
  school:     { label: 'Школы и детсады', statePercent: 90, icon: '🏫' },
  roads:      { label: 'Дороги и тротуары', statePercent: 70, icon: '🛤️' },
  landscaping:{ label: 'Озеленение', statePercent: 50, icon: '🌳' },
  commercial: { label: 'Коммерческие', statePercent: 0, icon: '🏢' },
}

export const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string }> = {
  active:      { label: 'Сбор средств', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  funded:      { label: 'Собрано', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  in_progress: { label: 'В работе', color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  completed:   { label: 'Завершён', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  expired:     { label: 'Истёк', color: 'bg-red-50 text-red-600 border-red-200' },
}

export const DONOR_TIER_CONFIG: Record<DonorTier, { label: string; min: number; max: number; color: string }> = {
  participant: { label: 'Участник', min: 500, max: 4999, color: 'text-gray-600' },
  patron:      { label: 'Меценат', min: 5000, max: 49999, color: 'text-blue-600' },
  founder:     { label: 'Основатель', min: 50000, max: 500000, color: 'text-amber-600' },
  corporate:   { label: 'Корп. партнёр', min: 0, max: Infinity, color: 'text-purple-600' },
}

export function getDonorTier(amount: number): DonorTier {
  if (amount >= 50000) return 'founder'
  if (amount >= 5000) return 'patron'
  return 'participant'
}

export function getCitizenTarget(totalAmount: number, category: CampaignCategory): number {
  const statePercent = CATEGORY_CONFIG[category].statePercent
  return Math.round(totalAmount * (100 - statePercent) / 100)
}

export function getStateMatch(totalAmount: number, category: CampaignCategory): number {
  const statePercent = CATEGORY_CONFIG[category].statePercent
  return Math.round(totalAmount * statePercent / 100)
}

export function getCampaignProgress(campaign: Campaign): number {
  if (campaign.citizen_target === 0) return 100
  return Math.min(100, Math.round((campaign.citizen_raised / campaign.citizen_target) * 100))
}

const MS_MIN = 60_000
const MS_HOUR = 60 * MS_MIN
const MS_DAY = 24 * MS_HOUR

/** Remaining or elapsed time broken into calendar-like components (floor-based). */
export function getDeadlineComponents(
  deadlineIso: string,
  nowMs: number = Date.now()
): { isPast: boolean; days: number; hours: number; minutes: number } {
  const deadlineMs = new Date(deadlineIso).getTime()
  const delta = deadlineMs - nowMs
  const isPast = delta <= 0
  const absMs = Math.abs(delta)
  const days = Math.floor(absMs / MS_DAY)
  const hours = Math.floor((absMs % MS_DAY) / MS_HOUR)
  const minutes = Math.floor((absMs % MS_HOUR) / MS_MIN)
  return { isPast, days, hours, minutes }
}

/** Russian countdown / "ago" label for crowdfunding deadline (hours + minutes). */
export function formatCrowdfundingCountdown(
  deadlineIso: string,
  nowMs: number = Date.now()
): string {
  const { isPast, days, hours, minutes } = getDeadlineComponents(deadlineIso, nowMs)
  if (!isPast) {
    if (days > 0) {
      const parts: string[] = [`${days} дн.`]
      if (hours > 0) parts.push(`${hours} ч.`)
      if (minutes > 0) parts.push(`${minutes} мин`)
      return parts.join(' ')
    }
    if (hours > 0) {
      return minutes > 0 ? `${hours} ч. ${minutes} мин` : `${hours} ч.`
    }
    if (minutes > 0) return `${minutes} мин`
    return 'меньше минуты'
  }
  if (days > 0) return `${days} дн. назад`
  if (hours > 0) return `${hours} ч. назад`
  if (minutes > 0) return `${minutes} мин. назад`
  return 'только что'
}

export function getDaysLeft(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / MS_DAY)
}

/** True when the campaign deadline (ISO string) is in the past. */
export function isCrowdfundingDeadlinePassed(deadlineIso: string, nowMs: number = Date.now()): boolean {
  return getDeadlineComponents(deadlineIso, nowMs).isPast
}

/**
 * Status for UI and filters when the API still says ACTIVE but the deadline passed
 * or the citizen goal is already met.
 */
export function getEffectiveCrowdfundingStatus(c: Campaign, nowMs: number = Date.now()): CampaignStatus {
  const progress = getCampaignProgress(c)
  if (c.status === 'active' && progress >= 100) return 'funded'
  if (c.status !== 'active') return c.status
  if (getDeadlineComponents(c.deadline, nowMs).isPast && progress < 100) return 'expired'
  return 'active'
}

export { formatTengeWithCrypto as formatTenge, getCryptoEquivalent } from '@/lib/contracts'

// Demo data — realistic Almaty campaigns
export const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: 'cf-1',
    title: 'Детская площадка во дворе ЖК «Алтын Булак»',
    description: 'Установка современной детской площадки с безопасным покрытием, качелями, горками и спортивным уголком для детей 3–12 лет. Старая площадка демонтирована в 2024 году из-за аварийного состояния, двор обслуживает 4 многоэтажных дома (~800 семей).',
    district: 'Ауэзовский',
    category: 'playground',
    status: 'active',
    target_amount: 8_500_000,
    citizen_target: 850_000,
    state_match: 7_650_000,
    citizen_raised: 623_000,
    state_deposited: false,
    donor_count: 47,
    deadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    creator: 'Айгуль Касымова',
    creator_wallet: 'DemoWallet3333333333333333333333333333333333',
    creator_tier: 'Gold',
    lat: 43.2395,
    lng: 76.8742,
    donors: [
      { id: 'd1', name: 'Марат Б.', amount: 50000, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), tier: 'founder', anonymous: false },
      { id: 'd2', name: 'Анонимный донор', amount: 15000, timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), tier: 'patron', anonymous: true },
      { id: 'd3', name: 'Дана К.', amount: 5000, timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), tier: 'patron', anonymous: false },
      { id: 'd4', name: 'Серик А.', amount: 2000, timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), tier: 'participant', anonymous: false },
      { id: 'd5', name: 'Алия М.', amount: 1000, timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), tier: 'participant', anonymous: false },
    ],
  },
  {
    id: 'cf-2',
    title: 'Ремонт тротуара по ул. Жандосова (от Манаса до Тимирязева)',
    description: 'Замена разрушенной тротуарной плитки на участке 1.2 км. Участок является основным пешеходным маршрутом к школе №135 и поликлинике №7. Зимой образуются наледи из-за неровностей, травмы пешеходов фиксируются ежегодно.',
    district: 'Бостандыкский',
    category: 'roads',
    status: 'active',
    target_amount: 15_000_000,
    citizen_target: 4_500_000,
    state_match: 10_500_000,
    citizen_raised: 1_230_000,
    state_deposited: false,
    donor_count: 23,
    deadline: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    creator: 'Бауржан Нурланов',
    creator_wallet: 'DemoWallet2222222222222222222222222222222222',
    creator_tier: 'Silver',
    lat: 43.2156,
    lng: 76.8892,
    donors: [
      { id: 'd6', name: 'ТОО «БизнесГрупп»', amount: 500000, timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), tier: 'corporate', anonymous: false },
      { id: 'd7', name: 'Нурлан Т.', amount: 25000, timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), tier: 'patron', anonymous: false },
      { id: 'd8', name: 'Анонимный донор', amount: 10000, timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), tier: 'patron', anonymous: true },
    ],
  },
  {
    id: 'cf-3',
    title: 'Озеленение сквера на пересечении Абая и Байтурсынова',
    description: 'Высадка 40 деревьев (клёны, берёзы, ели) и 200 кустарников, установка системы капельного полива, укладка газона 2000 м². Пустырь на этом месте используется как стихийная парковка. Жители микрорайона собирают подписи с 2023 года.',
    district: 'Алмалинский',
    category: 'landscaping',
    status: 'funded',
    target_amount: 6_000_000,
    citizen_target: 3_000_000,
    state_match: 3_000_000,
    citizen_raised: 3_000_000,
    state_deposited: true,
    donor_count: 89,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    creator: 'Инициативная группа «Зелёный Алматы»',
    creator_wallet: 'DemoWallet3333333333333333333333333333333333',
    creator_tier: 'Gold',
    lat: 43.2401,
    lng: 76.9198,
    contract_id: '5',
    donors: [
      { id: 'd9', name: 'Аскар Ж.', amount: 100000, timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), tier: 'founder', anonymous: false },
      { id: 'd10', name: 'Гульнара С.', amount: 50000, timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), tier: 'founder', anonymous: false },
      { id: 'd11', name: 'Камиль Р.', amount: 5000, timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), tier: 'patron', anonymous: false },
    ],
  },
  {
    id: 'cf-4',
    title: 'Ремонт спортзала школы №92 (мкр. Алгабас)',
    description: 'Капитальный ремонт спортивного зала: замена полового покрытия, обновление освещения (LED), установка вентиляции, покупка нового спортинвентаря. Зал не ремонтировался с 2008 года, обслуживает 1200 учеников.',
    district: 'Алатауский',
    category: 'school',
    status: 'active',
    target_amount: 12_000_000,
    citizen_target: 1_200_000,
    state_match: 10_800_000,
    citizen_raised: 890_000,
    state_deposited: false,
    donor_count: 62,
    deadline: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    creator: 'Родительский комитет школы №92',
    creator_wallet: 'DemoWallet1111111111111111111111111111111111',
    creator_tier: 'Silver',
    lat: 43.1897,
    lng: 76.8456,
    donors: [
      { id: 'd12', name: 'Ержан К.', amount: 75000, timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), tier: 'founder', anonymous: false },
      { id: 'd13', name: 'Анонимный донор', amount: 30000, timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), tier: 'patron', anonymous: true },
      { id: 'd14', name: 'Мадина А.', amount: 3000, timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), tier: 'participant', anonymous: false },
    ],
  },
  {
    id: 'cf-5',
    title: 'Освещение пешеходной аллеи вдоль р. Есентай',
    description: 'Установка 35 LED-фонарей вдоль пешеходной аллеи протяжённостью 1.5 км. Участок используется для вечерних прогулок и пробежек, но после 18:00 зимой полностью тёмный. В 2024 году зафиксировано 3 случая нападений.',
    district: 'Медеуский',
    category: 'landscaping',
    status: 'active',
    target_amount: 9_200_000,
    citizen_target: 4_600_000,
    state_match: 4_600_000,
    citizen_raised: 2_150_000,
    state_deposited: false,
    donor_count: 34,
    deadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    creator: 'Тимур Сагинаев',
    creator_wallet: 'DemoWallet1111111111111111111111111111111111',
    creator_tier: 'Gold',
    lat: 43.2311,
    lng: 76.9488,
    donors: [
      { id: 'd15', name: 'ТОО «Green Light»', amount: 300000, timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), tier: 'corporate', anonymous: false },
      { id: 'd16', name: 'Анна Л.', amount: 20000, timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), tier: 'patron', anonymous: false },
    ],
  },
  {
    id: 'cf-6',
    title: 'Установка камер видеонаблюдения (мкр. Орбита-2)',
    description: 'Монтаж 20 камер видеонаблюдения на ключевых точках микрорайона: подъезды, парковки, детские площадки. Интеграция с системой «Сергек». Жители жалуются на автокражи и вандализм.',
    district: 'Бостандыкский',
    category: 'commercial',
    status: 'expired',
    target_amount: 4_800_000,
    citizen_target: 4_800_000,
    state_match: 0,
    citizen_raised: 1_900_000,
    state_deposited: false,
    donor_count: 15,
    deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 63 * 24 * 60 * 60 * 1000).toISOString(),
    creator: 'КСК «Орбита-2»',
    creator_wallet: 'DemoWallet2222222222222222222222222222222222',
    creator_tier: 'Silver',
    lat: 43.2256,
    lng: 76.8992,
    donors: [
      { id: 'd17', name: 'Олег В.', amount: 100000, timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), tier: 'founder', anonymous: false },
      { id: 'd18', name: 'Анонимный донор', amount: 50000, timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), tier: 'founder', anonymous: true },
    ],
  },
]

export function getCampaignById(id: string): Campaign | undefined {
  return DEMO_CAMPAIGNS.find((c) => c.id === id)
}

// Map Prisma enum values to frontend types
const STATUS_MAP: Record<string, CampaignStatus> = {
  ACTIVE: 'active', active: 'active',
  FUNDED: 'funded', funded: 'funded',
  MATCHED: 'funded', // treat matched as funded for display
  IN_PROGRESS: 'in_progress', in_progress: 'in_progress',
  COMPLETED: 'completed', completed: 'completed',
  EXPIRED: 'expired', expired: 'expired',
}

const CATEGORY_MAP: Record<string, CampaignCategory> = {
  PLAYGROUND: 'playground', playground: 'playground',
  SCHOOL: 'school', school: 'school',
  ROADS: 'roads', roads: 'roads',
  LANDSCAPING: 'landscaping', landscaping: 'landscaping',
  COMMERCIAL: 'commercial', commercial: 'commercial',
}

const TIER_MAP: Record<string, string> = {
  NEW: 'Bronze', ACTIVE: 'Silver', TRUSTED: 'Gold', GUARDIAN: 'Platinum',
}

/** Normalize API response (Prisma format) to frontend Campaign shape */
export function normalizeCampaign(c: any): Campaign {
  const contributions = c.contributions || []
  return {
    id: c.id,
    title: c.title,
    description: c.description || '',
    district: c.district,
    category: CATEGORY_MAP[c.category] || 'landscaping',
    status: STATUS_MAP[c.status] || 'active',
    target_amount: Number(c.targetAmount || c.target_amount || 0),
    citizen_target: Number(c.citizenTarget || c.citizen_target || 0),
    state_match: Number(c.stateMatch || c.state_match || 0),
    citizen_raised: Number(c.citizenRaised || c.citizen_raised || 0),
    state_deposited: c.stateDeposited ?? c.state_deposited ?? false,
    donor_count: c.donorCount ?? c._count?.contributions ?? c.donor_count ?? 0,
    deadline: c.deadline,
    created_at: c.createdAt || c.created_at,
    creator: typeof c.creator === 'string' ? c.creator : (c.creator?.walletAddress?.slice(0, 8) + '...' || ''),
    creator_wallet: typeof c.creator === 'string' ? (c.creator_wallet || '') : (c.creator?.walletAddress || c.creator_wallet || ''),
    creator_tier: typeof c.creator === 'object' ? (TIER_MAP[c.creator?.tier] || 'Bronze') : (c.creator_tier || 'Bronze'),
    lat: c.lat,
    lng: c.lng,
    contract_id: c.contractId || c.contract_id,
    onChainPubkey: c.onChainPubkey || c.on_chain_pubkey || null,
    donors: contributions.map((d: any) => ({
      id: d.id,
      name: d.anonymous ? 'Анонимный донор' : (d.citizen?.walletAddress?.slice(0, 8) + '...' || 'Донор'),
      amount: Number(d.amount),
      timestamp: d.createdAt || d.timestamp,
      tier: getDonorTier(Number(d.amount)),
      anonymous: d.anonymous,
    })),
  }
}
