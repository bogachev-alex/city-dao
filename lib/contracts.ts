export type MilestoneStatus = 'pending' | 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'overdue'
export type ContractStatus = 'active' | 'penalized' | 'completed' | 'disputed'

export interface Milestone {
  id: string
  desc: string
  deadline_days: number
  tranche_pct: number
  status: MilestoneStatus
}

export interface Contract {
  id: string
  title: string
  contractor: string
  amount_usdc: number
  deadline: string
  district: string
  status: ContractStatus
  lat: number
  lng: number
  escrow_amount: number
  penalty_amount: number
  days_overdue?: number
  milestones: Milestone[]
}

export const DEMO_CONTRACTS: Contract[] = [
  {
    id: '1',
    title: 'Ремонт тротуара, набережная Весновки',
    contractor: 'ТОО СтройАлматы',
    amount_usdc: 45000,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    district: 'Медеуский',
    status: 'active',
    lat: 43.2711,
    lng: 76.9388,
    escrow_amount: 9000,
    penalty_amount: 0,
    milestones: [
      { id: '1-1', desc: 'Демонтаж старой плитки', deadline_days: 3, tranche_pct: 25, status: 'accepted' },
      { id: '1-2', desc: 'Укладка основания', deadline_days: 6, tranche_pct: 50, status: 'under_review' },
      { id: '1-3', desc: 'Финальная укладка + бордюры', deadline_days: 10, tranche_pct: 25, status: 'pending' },
    ],
  },
  {
    id: '2',
    title: 'Ямочный ремонт ул. Яссауи',
    contractor: 'ТОО АлматыДорСтрой',
    amount_usdc: 120000,
    deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    district: 'Ауэзовский',
    status: 'penalized',
    lat: 43.2395,
    lng: 76.8742,
    escrow_amount: 24000,
    penalty_amount: 6000,
    days_overdue: 5,
    milestones: [
      { id: '2-1', desc: 'Подготовительные работы', deadline_days: 2, tranche_pct: 30, status: 'accepted' },
      { id: '2-2', desc: 'Асфальтирование', deadline_days: 5, tranche_pct: 70, status: 'overdue' },
    ],
  },
  {
    id: '3',
    title: 'Замена электросетей мкр. Акжар',
    contractor: 'ТОО ЭнергоСервис',
    amount_usdc: 380000,
    deadline: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    district: 'Наурызбайский',
    status: 'active',
    lat: 43.1897,
    lng: 76.8456,
    escrow_amount: 76000,
    penalty_amount: 0,
    milestones: [
      { id: '3-1', desc: 'Проектная документация', deadline_days: 5, tranche_pct: 10, status: 'accepted' },
      { id: '3-2', desc: 'Демонтаж старых сетей', deadline_days: 15, tranche_pct: 30, status: 'pending' },
      { id: '3-3', desc: 'Прокладка новых кабелей', deadline_days: 25, tranche_pct: 40, status: 'pending' },
      { id: '3-4', desc: 'Пусконаладочные работы', deadline_days: 35, tranche_pct: 20, status: 'pending' },
    ],
  },
  {
    id: '4',
    title: 'Строительство детского сада мкр. Курамыс',
    contractor: 'ТОО МегаСтрой',
    amount_usdc: 250000,
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    district: 'Бостандыкский',
    status: 'active',
    lat: 43.2156,
    lng: 76.8892,
    escrow_amount: 50000,
    penalty_amount: 0,
    milestones: [
      { id: '4-1', desc: 'Фундамент', deadline_days: 20, tranche_pct: 30, status: 'under_review' },
      { id: '4-2', desc: 'Стены и перекрытия', deadline_days: 40, tranche_pct: 40, status: 'pending' },
      { id: '4-3', desc: 'Отделка и сдача', deadline_days: 60, tranche_pct: 30, status: 'pending' },
    ],
  },
]

export const DISTRICTS = [
  'Алатауский',
  'Алмалинский',
  'Ауэзовский',
  'Бостандыкский',
  'Жетысуский',
  'Медеуский',
  'Наурызбайский',
  'Турксибский',
]

export function getContractById(id: string): Contract | undefined {
  return DEMO_CONTRACTS.find((c) => c.id === id)
}

// Map Prisma enum values (UPPER_CASE) to frontend types (lower_case)
const CONTRACT_STATUS_MAP: Record<string, ContractStatus> = {
  ACTIVE: 'active', active: 'active',
  PENALIZED: 'penalized', penalized: 'penalized',
  COMPLETED: 'completed', completed: 'completed',
  DISPUTED: 'disputed', disputed: 'disputed',
  TERMINATED: 'completed', // treat terminated as completed for display
}

const MILESTONE_STATUS_MAP: Record<string, MilestoneStatus> = {
  PENDING: 'pending', pending: 'pending',
  SUBMITTED: 'submitted', submitted: 'submitted',
  UNDER_REVIEW: 'under_review', under_review: 'under_review',
  ACCEPTED: 'accepted', accepted: 'accepted',
  REJECTED: 'rejected', rejected: 'rejected',
  OVERDUE: 'overdue', overdue: 'overdue',
}

/** Normalize API response (Prisma format) to frontend Contract shape */
export function normalizeContract(c: any): Contract {
  return {
    id: c.id,
    title: c.title,
    contractor: c.contractor?.name || c.contractor || '',
    amount_usdc: Number(c.totalAmount || c.amount_usdc || 0) / 1000,
    deadline: c.deadline,
    district: c.district,
    status: CONTRACT_STATUS_MAP[c.status] || 'active',
    lat: c.lat,
    lng: c.lng,
    escrow_amount: Number(c.escrowAmount || c.escrow_amount || 0),
    penalty_amount: Number(c.penaltyAmount || c.penalty_amount || 0),
    days_overdue: c.days_overdue,
    milestones: (c.milestones || []).map((m: any) => ({
      id: m.id,
      desc: m.description || m.desc,
      deadline_days: m.deadlineDays || m.deadline_days,
      tranche_pct: m.tranchePct || m.tranche_pct,
      status: MILESTONE_STATUS_MAP[m.status] || 'pending',
    })),
  }
}

export function getDaysUntilDeadline(deadline: string): number {
  const now = Date.now()
  const dl = new Date(deadline).getTime()
  return Math.ceil((dl - now) / (1000 * 60 * 60 * 24))
}

export function getContractPinColor(contract: Contract): 'green' | 'yellow' | 'red' | 'checkmark' {
  if (contract.status === 'completed') return 'checkmark'
  if (contract.status === 'penalized') return 'red'
  const days = getDaysUntilDeadline(contract.deadline)
  if (days < 7) return 'yellow'
  return 'green'
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ru-KZ').format(amount)
}

export function getMilestoneCompletedCount(contract: Contract): number {
  return contract.milestones.filter((m) => m.status === 'accepted').length
}
