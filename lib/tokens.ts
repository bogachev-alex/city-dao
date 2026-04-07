// Demo ADL (Adal Coin) token engine — localStorage-based, no blockchain

export type TokenAction =
  | 'registration'
  | 'jury_vote'
  | 'jury_reveal'
  | 'crowdfunding_donation'
  | 'treasury_vote'
  | 'contract_report'
  | 'daily_login'
  | 'proposal_created'

export interface TokenTransaction {
  id: string
  action: TokenAction
  amount: number
  description: string
  timestamp: string
}

export interface TokenWallet {
  balance: number
  transactions: TokenTransaction[]
}

const STORAGE_KEY = 'straita_tokens'

const REWARD_TABLE: Record<TokenAction, { amount: number; description: string }> = {
  registration:          { amount: 100, description: 'Регистрация гражданина' },
  jury_vote:             { amount: 25,  description: 'Голосование в жюри (commit)' },
  jury_reveal:           { amount: 25,  description: 'Раскрытие голоса (reveal)' },
  crowdfunding_donation: { amount: 15,  description: 'Участие в краудфандинге' },
  treasury_vote:         { amount: 20,  description: 'Голосование по предложению казны' },
  contract_report:       { amount: 30,  description: 'Сообщение о нарушении' },
  daily_login:           { amount: 5,   description: 'Ежедневный вход' },
  proposal_created:      { amount: 50,  description: 'Создание предложения в казну' },
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getWallet(): TokenWallet {
  if (typeof window === 'undefined') return { balance: 0, transactions: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { balance: 0, transactions: [] }
    return JSON.parse(raw) as TokenWallet
  } catch {
    return { balance: 0, transactions: [] }
  }
}

function saveWallet(wallet: TokenWallet): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet))
}

/** Award tokens for an action. Returns the new transaction or null if SSR. */
export function awardTokens(action: TokenAction): TokenTransaction | null {
  if (typeof window === 'undefined') return null

  const reward = REWARD_TABLE[action]
  const tx: TokenTransaction = {
    id: generateId(),
    action,
    amount: reward.amount,
    description: reward.description,
    timestamp: new Date().toISOString(),
  }

  const wallet = getWallet()
  wallet.balance += tx.amount
  wallet.transactions.unshift(tx)
  saveWallet(wallet)

  // Dispatch custom event so UI components can react
  window.dispatchEvent(new CustomEvent('straita-token-award', { detail: tx }))

  return tx
}

/** Get the reward amount for an action (for display purposes) */
export function getRewardAmount(action: TokenAction): number {
  return REWARD_TABLE[action].amount
}

/** Get formatted balance string */
export function formatBalance(balance: number): string {
  return balance.toLocaleString('ru-RU')
}

/** Reset wallet (for testing) */
export function resetWallet(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
