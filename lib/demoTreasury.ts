/**
 * Demo treasury data — used when database is unavailable.
 * Based on realistic Almaty district budgets and common infrastructure issues.
 */

interface DemoProposal {
  id: string
  title: string
  description: string
  amount: string
  category: string
  status: string
  votingEnds: string | null
  votesFor: number
  votesAgainst: number
  quorumMet: boolean
  votes: { id: string; citizenId: string; inFavor: boolean; createdAt: string; citizen: { walletAddress: string } }[]
  aiResearch: null
}

interface DemoPenalty {
  id: string
  type: string
  amountTenge: string
  daysOverdue: number | null
  createdAt: string
  contract: { id: string; title: string }
}

interface DemoTreasury {
  id: string
  district: string
  walletAddress: string | null
  pdaAddress: string | null
  balance: string
  balanceOnChain: string | null
  totalPenaltyIncome: number
  proposals: DemoProposal[]
  penalties: DemoPenalty[]
}

const now = new Date()
const inTwoWeeks = new Date(now.getTime() + 14 * 86400000).toISOString()
const inOneWeek = new Date(now.getTime() + 7 * 86400000).toISOString()
const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString()

const DEMO_TREASURIES: Record<string, DemoTreasury> = {
  'Ауэзовский': {
    id: 'demo-treasury-auezov',
    district: 'Ауэзовский',
    walletAddress: '3it6N2wRR12CaTc7unSogw3mYQV8rjLyZPvN8mr3FTbg',
    pdaAddress: '9SnE...mbB1',
    balance: '15500000',
    balanceOnChain: null,
    totalPenaltyIncome: 25_950_000,
    proposals: [
      {
        id: 'demo-prop-1',
        title: 'Замена водопроводных труб на ул. Жубанова',
        description: 'Аварийная замена 1.2 км водопровода (D=300мм) от перекрёстка Жубанова-Утеген Батыра до жилого массива. Текущие трубы 1987 года — 6 аварий за зиму 2024/25.',
        amount: '8500000',
        category: 'ЖКХ',
        status: 'VOTING',
        votingEnds: inTwoWeeks,
        votesFor: 34,
        votesAgainst: 8,
        quorumMet: false,
        votes: [],
        aiResearch: null,
      },
      {
        id: 'demo-prop-2',
        title: 'Освещение пешеходной зоны парка Фемили',
        description: 'Установка 48 светодиодных фонарей вдоль аллей парка Фемили (мкр. Аксай-4). Сейчас парк не освещён после 18:00 — жалобы жителей на безопасность.',
        amount: '3200000',
        category: 'Освещение',
        status: 'VOTING',
        votingEnds: inOneWeek,
        votesFor: 52,
        votesAgainst: 3,
        quorumMet: true,
        votes: [],
        aiResearch: null,
      },
      {
        id: 'demo-prop-3',
        title: 'Ремонт тротуаров мкр. Аксай-3',
        description: 'Капитальный ремонт тротуарной плитки на ул. Маречека и прилегающих дворах. Площадь: 4,200 кв.м. Текущее покрытие в аварийном состоянии с 2019 года.',
        amount: '5800000',
        category: 'Дороги',
        status: 'VOTING',
        votingEnds: inTwoWeeks,
        votesFor: 21,
        votesAgainst: 15,
        quorumMet: false,
        votes: [],
        aiResearch: null,
      },
      {
        id: 'demo-prop-4',
        title: 'Установка детской площадки мкр. Орбита-1',
        description: 'Современная детская площадка (возраст 3-12 лет) с антитравматическим покрытием. Двор на 200+ квартир не имеет оборудованной площадки.',
        amount: '4100000',
        category: 'Соц.объекты',
        status: 'APPROVED',
        votingEnds: threeDaysAgo,
        votesFor: 67,
        votesAgainst: 4,
        quorumMet: true,
        votes: [],
        aiResearch: null,
      },
    ],
    penalties: [
      { id: 'demo-pen-1', type: 'GHOST_SITE', amountTenge: '4750000', daysOverdue: null, createdAt: '2025-12-15T10:00:00Z', contract: { id: '2', title: 'Ремонт теплосети мкр. Жетысу-2' } },
      { id: 'demo-pen-2', type: 'QUALITY_REJECTED', amountTenge: '9500000', daysOverdue: null, createdAt: '2025-11-20T14:30:00Z', contract: { id: '2', title: 'Ремонт теплосети мкр. Жетысу-2' } },
      { id: 'demo-pen-3', type: 'TIME_OVERDUE', amountTenge: '5700000', daysOverdue: 6, createdAt: '2025-11-01T09:00:00Z', contract: { id: '2', title: 'Ремонт теплосети мкр. Жетысу-2' } },
      { id: 'demo-pen-4', type: 'TIME_OVERDUE', amountTenge: '6000000', daysOverdue: 5, createdAt: '2025-10-15T12:00:00Z', contract: { id: 'yassaui', title: 'Ямочный ремонт ул. Яссауи' } },
    ],
  },
  'Медеуский': {
    id: 'demo-treasury-medeu',
    district: 'Медеуский',
    walletAddress: null,
    pdaAddress: null,
    balance: '18900000',
    balanceOnChain: null,
    totalPenaltyIncome: 12_300_000,
    proposals: [
      {
        id: 'demo-prop-medeu-1',
        title: 'Реконструкция арыка на ул. Кабанбай Батыра',
        description: 'Очистка и укрепление 800м арычной системы от Кабанбай Батыра до Достык. Предотвращение подтопления при весеннем таянии.',
        amount: '6200000',
        category: 'ЖКХ',
        status: 'VOTING',
        votingEnds: inTwoWeeks,
        votesFor: 28,
        votesAgainst: 5,
        quorumMet: false,
        votes: [],
        aiResearch: null,
      },
      {
        id: 'demo-prop-medeu-2',
        title: 'Видеонаблюдение парковки у Зелёного базара',
        description: '16 камер с AI-распознаванием номеров. Снижение краж и парковочных нарушений в зоне Центрального рынка.',
        amount: '2800000',
        category: 'Безопасность',
        status: 'APPROVED',
        votingEnds: threeDaysAgo,
        votesFor: 45,
        votesAgainst: 2,
        quorumMet: true,
        votes: [],
        aiResearch: null,
      },
    ],
    penalties: [
      { id: 'demo-pen-medeu-1', type: 'TIME_OVERDUE', amountTenge: '7800000', daysOverdue: 8, createdAt: '2025-12-01T08:00:00Z', contract: { id: 'vesnovka', title: 'Ремонт тротуара набережная Весновки' } },
      { id: 'demo-pen-medeu-2', type: 'QUALITY_REJECTED', amountTenge: '4500000', daysOverdue: null, createdAt: '2025-11-10T16:00:00Z', contract: { id: 'vesnovka', title: 'Ремонт тротуара набережная Весновки' } },
    ],
  },
  'Бостандыкский': {
    id: 'demo-treasury-bostandyk',
    district: 'Бостандыкский',
    walletAddress: null,
    pdaAddress: null,
    balance: '8200000',
    balanceOnChain: null,
    totalPenaltyIncome: 6_500_000,
    proposals: [
      {
        id: 'demo-prop-bos-1',
        title: 'Ремонт школьного стадиона школы №125',
        description: 'Замена асфальтового покрытия на резиновое, установка ворот и разметка. Текущее покрытие травмоопасно — 3 травмы за 2024 учебный год.',
        amount: '4500000',
        category: 'Образование',
        status: 'VOTING',
        votingEnds: inTwoWeeks,
        votesFor: 38,
        votesAgainst: 6,
        quorumMet: false,
        votes: [],
        aiResearch: null,
      },
    ],
    penalties: [
      { id: 'demo-pen-bos-1', type: 'TIME_OVERDUE', amountTenge: '6500000', daysOverdue: 12, createdAt: '2025-11-25T11:00:00Z', contract: { id: 'kuramys', title: 'Строительство детского сада мкр. Курамыс' } },
    ],
  },
}

// Generate minimal empty treasuries for remaining districts
const EMPTY_DISTRICTS = ['Алатауский', 'Алмалинский', 'Жетысуский', 'Наурызбайский', 'Турксибский']
for (const d of EMPTY_DISTRICTS) {
  DEMO_TREASURIES[d] = {
    id: `demo-treasury-${d.slice(0, 4).toLowerCase()}`,
    district: d,
    walletAddress: null,
    pdaAddress: null,
    balance: String(Math.floor(2_000_000 + Math.random() * 8_000_000)),
    balanceOnChain: null,
    totalPenaltyIncome: 0,
    proposals: [],
    penalties: [],
  }
}

export function getDemoTreasury(district: string): DemoTreasury | null {
  return DEMO_TREASURIES[district] ?? null
}
