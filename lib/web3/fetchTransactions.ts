/**
 * Fetch real Solana transactions for all Amanat programs.
 *
 * Reads transaction signatures from Solana RPC, parses instruction names,
 * and returns them in the same shape as DEMO_TRANSACTIONS for the feed.
 */

import { Connection, PublicKey, type ConfirmedSignatureInfo } from '@solana/web3.js'
import { PROGRAM_IDS, SOLANA_RPC_URL } from './constants'
import type { TxType } from '@/lib/demoTransactions'

export interface OnChainTx {
  signature: string
  type: TxType
  description: string
  timestamp: string // ISO
  amount?: number
  programKey: string
}

// Map program ID → human-readable program key
const PROGRAM_KEY_MAP = new Map<string, string>(
  Object.entries(PROGRAM_IDS).map(([key, pk]) => [pk.toBase58(), key])
)

// Anchor instruction discriminator → TxType + description template
// Discriminators are first 8 bytes of SHA-256("global:<instruction_name>")
const INSTRUCTION_LABELS: Record<string, { type: TxType; label: string }> = {
  // contract_registry
  register_contract: { type: 'register_contract', label: 'Регистрация контракта' },
  submit_milestone: { type: 'submit_milestone', label: 'Отправка этапа на проверку' },
  accept_milestone: { type: 'release_tranche', label: 'Принятие этапа / выплата транша' },
  reject_milestone: { type: 'submit_milestone', label: 'Отклонение этапа' },
  check_deadline: { type: 'trigger_penalty', label: 'Проверка дедлайна / штраф' },
  terminate_contract: { type: 'trigger_penalty', label: 'Расторжение контракта' },
  // citizen_registry
  register_citizen: { type: 'register_citizen', label: 'Регистрация гражданина' },
  update_reputation: { type: 'register_citizen', label: 'Обновление репутации' },
  record_missed_jury: { type: 'register_citizen', label: 'Пропуск присяжных' },
  // district_treasury
  init_treasury: { type: 'treasury_vote', label: 'Инициализация казны района' },
  deposit: { type: 'treasury_vote', label: 'Депозит в казну' },
  create_proposal: { type: 'treasury_vote', label: 'Создание предложения' },
  vote_on_proposal: { type: 'treasury_vote', label: 'Голосование за предложение' },
  execute_proposal: { type: 'treasury_vote', label: 'Исполнение предложения' },
  // crowdfunding
  init_campaign: { type: 'cf_contribute', label: 'Создание кампании' },
  contribute: { type: 'cf_contribute', label: 'Взнос в кампанию' },
  // jury_mechanism
  init_session: { type: 'treasury_vote', label: 'Инициализация жюри' },
  commit_vote: { type: 'treasury_vote', label: 'Коммит голоса' },
  reveal_vote: { type: 'treasury_vote', label: 'Раскрытие голоса' },
  // penalty_engine
  execute_penalty: { type: 'trigger_penalty', label: 'Исполнение штрафа' },
}

/**
 * Fetch recent transactions across all Amanat programs.
 * Returns combined, time-sorted results.
 */
export async function fetchOnChainTransactions(
  limit: number = 20,
  connection?: Connection,
): Promise<OnChainTx[]> {
  const conn = connection || new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || SOLANA_RPC_URL,
    'confirmed',
  )

  // Fetch signatures from all programs in parallel
  const programEntries = Object.entries(PROGRAM_IDS)
  const perProgram = Math.max(5, Math.ceil(limit / programEntries.length))

  const results = await Promise.allSettled(
    programEntries.map(async ([key, programId]) => {
      const sigs = await conn.getSignaturesForAddress(programId, { limit: perProgram })
      return sigs.map((sig) => ({ ...sig, programKey: key }))
    })
  )

  // Flatten successful results
  const allSigs: (ConfirmedSignatureInfo & { programKey: string })[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      allSigs.push(...r.value)
    }
  }

  // Sort by blockTime descending
  allSigs.sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0))

  // Map to OnChainTx
  const txs: OnChainTx[] = allSigs.slice(0, limit).map((sig) => {
    // Try to extract instruction name from log messages
    const instructionName = parseInstructionFromMemo(sig.memo) || 'unknown'
    const meta = INSTRUCTION_LABELS[instructionName] || {
      type: 'register_contract' as TxType,
      label: `${sig.programKey}: транзакция`,
    }

    return {
      signature: sig.signature,
      type: meta.type,
      description: meta.label,
      timestamp: sig.blockTime
        ? new Date(sig.blockTime * 1000).toISOString()
        : new Date().toISOString(),
      programKey: sig.programKey,
    }
  })

  return txs
}

function parseInstructionFromMemo(memo: string | null): string | null {
  if (!memo) return null
  // Anchor logs: "Program log: Instruction: RegisterContract"
  const match = memo.match(/Instruction:\s*(\w+)/i)
  return match ? camelToSnake(match[1]) : null
}

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
}

/**
 * Fetch and parse transactions with full log data.
 * More expensive (one RPC call per tx) but gives instruction-level detail.
 */
export async function fetchParsedTransactions(
  limit: number = 10,
  connection?: Connection,
): Promise<OnChainTx[]> {
  const conn = connection || new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || SOLANA_RPC_URL,
    'confirmed',
  )

  // Get signatures across all programs
  const programEntries = Object.entries(PROGRAM_IDS)
  const perProgram = Math.max(3, Math.ceil(limit / programEntries.length))

  const allSigs: { sig: string; programKey: string; blockTime: number }[] = []

  const results = await Promise.allSettled(
    programEntries.map(async ([key, programId]) => {
      const sigs = await conn.getSignaturesForAddress(programId, { limit: perProgram })
      return sigs.map((s) => ({ sig: s.signature, programKey: key, blockTime: s.blockTime || 0 }))
    })
  )

  for (const r of results) {
    if (r.status === 'fulfilled') allSigs.push(...r.value)
  }

  allSigs.sort((a, b) => b.blockTime - a.blockTime)
  const top = allSigs.slice(0, limit)

  if (top.length === 0) return []

  // Fetch parsed transactions in batch
  const parsedTxs = await conn.getParsedTransactions(
    top.map((t) => t.sig),
    { maxSupportedTransactionVersion: 0 },
  )

  const txs: OnChainTx[] = []

  for (let i = 0; i < top.length; i++) {
    const parsed = parsedTxs[i]
    const { sig, programKey, blockTime } = top[i]

    // Try to find instruction name from logs
    let instructionName: string | null = null
    if (parsed?.meta?.logMessages) {
      for (const log of parsed.meta.logMessages) {
        const match = log.match(/Instruction:\s*(\w+)/i)
        if (match) {
          instructionName = camelToSnake(match[1])
          break
        }
      }
    }

    const meta = instructionName && INSTRUCTION_LABELS[instructionName]
      ? INSTRUCTION_LABELS[instructionName]
      : { type: 'register_contract' as TxType, label: `${programKey}: транзакция` }

    txs.push({
      signature: sig,
      type: meta.type,
      description: meta.label,
      timestamp: blockTime
        ? new Date(blockTime * 1000).toISOString()
        : new Date().toISOString(),
      programKey,
    })
  }

  return txs
}
