import { getSolanaExplorerTxUrl } from '@/lib/blockchainDashboardModel'

export type TxType =
  | 'register_contract'
  | 'submit_milestone'
  | 'release_tranche'
  | 'trigger_penalty'
  | 'register_citizen'
  | 'treasury_vote'
  | 'cf_contribute'

export interface DemoTx {
  signature: string
  type: TxType
  description: string
  timestamp: Date
  amount?: number
  contractId?: string
  district?: string
}

const now = Date.now()
const m = (min: number) => new Date(now - min * 60 * 1000)

export const DEMO_TRANSACTIONS: DemoTx[] = [
  {
    signature: '5KQmzPBtnf8a2Rr7WvVqXeN3HkYLcTwD9oJsUeMbPzF4gXiR6NjCqAyE1dKpWu2hGsB8fLvTmZoCrQx3nD7tSwP',
    type: 'cf_contribute',
    description: 'Краудфандинг: взнос 25 000 ₸',
    timestamp: m(8),
    amount: 25000,
  },
  {
    signature: '3vXwQpN9kLmT6sEuFbRyHcJoZiWdAeG8nKfVqBxPsCh2tDjYrMaU5gL1oNwIeT4zXsKpFvQnD7mJuCbRyH6WaP',
    type: 'trigger_penalty',
    description: 'Штраф: Ямочный ремонт ул. Яссауи (6 000 USDC)',
    timestamp: m(25),
    amount: 6000,
    contractId: '2',
    district: 'Ауэзовский',
  },
  {
    signature: '2HxRtYmKbVqLpNsWfCjUeAoGdXzT5nE8iPrDyFwBuSg9cJvMkQ4aL3oZhN6rXtKpWeCfVnDqBsJuYmR7iLoPaT',
    type: 'release_tranche',
    description: 'Выплата транша: Демонтаж старой плитки (25%)',
    timestamp: m(42),
    amount: 11250,
    contractId: '1',
    district: 'Медеуский',
  },
  {
    signature: '4nWqPmXaKjLsT8eVbNoCfHrDzIuGy2dR9kBwEpFgQxAc6oJvMtYiS3hZ7lNuK5rXeWfPsDqCvBnJmTaL1oRyHg',
    type: 'submit_milestone',
    description: 'Этап: Укладка основания (на проверке)',
    timestamp: m(67),
    contractId: '1',
    district: 'Медеуский',
  },
  {
    signature: '7aLpWqXmNjKsT2eRbVoCfDrHzIuGy5dR9kBwEpFgQxAc6oJvMtYiS3hZ4lNuK8rXeWfPsDqCvBnJmTaL0oRyHg',
    type: 'treasury_vote',
    description: 'Голосование: Ауэзовский, предложение #3',
    timestamp: m(95),
    district: 'Ауэзовский',
  },
  {
    signature: '9bMpVqYnOkLrU3fScWpDgEsIvJtHz6eS0lCxFqGhRyBd7pKwNuZjT4iA5mOpXeVfQsDrCwAnKmTaL2nRyHgFpW',
    type: 'register_citizen',
    description: 'Регистрация гражданина-присяжного',
    timestamp: m(138),
  },
  {
    signature: '6cNqWrZoPlMsV4gTdXqEhFtJwKuIa7fT1mDyGrHsBe8qLxOvAkU5jB6nPqYfWgRtDsEwBoCmLuTaM3oSzIhGqV',
    type: 'register_contract',
    description: 'Контракт: Строительство д/с мкр. Курамыс',
    timestamp: m(210),
    amount: 250000,
    contractId: '4',
    district: 'Бостандыкский',
  },
  {
    signature: '1dOrXsApQmNtW5hUeYrFiGaKvLbJ8gU2nEzHsItCf9rMyPwBmV6kC7oQrZgXhStEuFwCoDoLvUbMaN4pTaJiHrW',
    type: 'register_contract',
    description: 'Контракт: Замена электросетей мкр. Акжар',
    timestamp: m(285),
    amount: 380000,
    contractId: '3',
    district: 'Наурызбайский',
  },
  {
    signature: '8ePoYtBrRnOuX6iVfZsGjHbLwMcK9hV3oFaItDuEg0sPxCnQ7lD8pRaYiWuFtGvHxEpDoDmWvCbNb5qUbKjIsX',
    type: 'submit_milestone',
    description: 'Этап: Подготовительные работы принят (30%)',
    timestamp: m(340),
    contractId: '2',
    district: 'Ауэзовский',
  },
  {
    signature: '2fQpZuCsSoRvY7jWgAhKiCmNxDdL0iW4pGbJuEvFh1tQyCqR8mE9qSbZjXvGuHwIqEpEnEoXwDcOc6rVcLkJtY',
    type: 'register_contract',
    description: 'Контракт: Ямочный ремонт ул. Яссауи',
    timestamp: m(415),
    amount: 120000,
    contractId: '2',
    district: 'Ауэзовский',
  },
  {
    signature: '3gRqAvDtTpSwZ8kXhBiLjDnOyEeM1jX5qHcKvFwGi2uRzDsS9nF0rTcAkYwHvIxJrFqFpFpYxEsDd7sWdMlKuZ',
    type: 'register_contract',
    description: 'Контракт: Ремонт тротуара, набережная Весновки',
    timestamp: m(480),
    amount: 45000,
    contractId: '1',
    district: 'Медеуский',
  },
]

export const TX_TYPE_META: Record<TxType, { icon: string; color: string; label: string }> = {
  register_contract: { icon: '📋', color: 'text-blue-400', label: 'Контракт' },
  submit_milestone: { icon: '📤', color: 'text-yellow-400', label: 'Этап' },
  release_tranche: { icon: '💸', color: 'text-emerald-400', label: 'Транш' },
  trigger_penalty: { icon: '⚠️', color: 'text-red-400', label: 'Штраф' },
  register_citizen: { icon: '👤', color: 'text-purple-400', label: 'Гражданин' },
  treasury_vote: { icon: '🗳️', color: 'text-indigo-400', label: 'Голосование' },
  cf_contribute: { icon: '🤝', color: 'text-orange-400', label: 'Краудфандинг' },
}

export function getTxExplorerUrl(signature: string): string {
  return getSolanaExplorerTxUrl(signature)
}

export function formatTxTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin} мин. назад`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} ч. назад`
  return `${Math.floor(diffHr / 24)} дн. назад`
}

export function truncateSig(sig: string): string {
  return `${sig.slice(0, 4)}…${sig.slice(-4)}`
}
