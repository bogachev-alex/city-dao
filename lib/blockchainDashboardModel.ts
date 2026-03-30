import { PROGRAM_IDS, SOLANA_NETWORK, SOLANA_RPC_URL } from '@/lib/web3/constants'

export type ProgramKey =
  | 'contractRegistry'
  | 'citizenRegistry'
  | 'juryMechanism'
  | 'penaltyEngine'
  | 'districtTreasury'
  | 'crowdfunding'

export interface ProgramDef {
  key: ProgramKey
  /** Instruction names (Anchor) — documented / planned */
  instructions: string[]
  /** Whether the app currently calls this program via hooks */
  wiredInApp: boolean
}

export const PROGRAM_DEFINITIONS: ProgramDef[] = [
  {
    key: 'contractRegistry',
    instructions: [
      'register_contract',
      'submit_milestone',
      'trigger_penalty',
      'release_tranche',
      'terminate_contract',
    ],
    wiredInApp: true,
  },
  {
    key: 'citizenRegistry',
    instructions: ['register_citizen'],
    wiredInApp: true,
  },
  {
    key: 'juryMechanism',
    instructions: [
      'init_session',
      'select_jury_vrf',
      'commit_vote',
      'reveal_vote',
      'replace_inactive',
      'finalize_session',
      'escalate_dispute',
    ],
    wiredInApp: false,
  },
  {
    key: 'penaltyEngine',
    instructions: ['execute_penalty'],
    wiredInApp: false,
  },
  {
    key: 'districtTreasury',
    instructions: ['vote_on_proposal', 'execute_proposal'],
    wiredInApp: true,
  },
  {
    key: 'crowdfunding',
    instructions: ['init_campaign', 'contribute'],
    wiredInApp: true,
  },
]

export interface FrontendOnChainAction {
  id: string
  programKey: ProgramKey
  hook: string
  method: string
  routeKeys: string[]
}

export const FRONTEND_ONCHAIN_ACTIONS: FrontendOnChainAction[] = [
  {
    id: 'register_contract',
    programKey: 'contractRegistry',
    hook: 'useContractRegistry',
    method: 'registerContract',
    routeKeys: ['admin'],
  },
  {
    id: 'register_citizen',
    programKey: 'citizenRegistry',
    hook: 'useCitizenRegistry',
    method: 'registerCitizen',
    routeKeys: ['register'],
  },
  {
    id: 'treasury_vote',
    programKey: 'districtTreasury',
    hook: 'useDistrictTreasury',
    method: 'voteOnProposal',
    routeKeys: ['treasury'],
  },
  {
    id: 'cf_create',
    programKey: 'crowdfunding',
    hook: 'useCrowdfunding',
    method: 'createCampaign',
    routeKeys: ['crowdfundingNew'],
  },
  {
    id: 'cf_contribute',
    programKey: 'crowdfunding',
    hook: 'useCrowdfunding',
    method: 'contribute',
    routeKeys: ['crowdfundingDetail'],
  },
]

export interface OffChainFlow {
  id: string
  routeKeys: string[]
}

export const OFF_CHAIN_FLOWS: OffChainFlow[] = [
  { id: 'jury_ui', routeKeys: ['contracts'] },
  { id: 'ai_research', routeKeys: ['treasury'] },
]

export function getProgramIdBase58(key: ProgramKey): string {
  return PROGRAM_IDS[key].toBase58()
}

export function getSolanaExplorerTxUrl(signature: string): string {
  const cluster = SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${SOLANA_NETWORK}`
  return `https://explorer.solana.com/tx/${signature}${cluster}`
}

export function getSolanaExplorerAddressUrl(address: string): string {
  const cluster = SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${SOLANA_NETWORK}`
  return `https://explorer.solana.com/address/${address}${cluster}`
}

export { SOLANA_NETWORK, SOLANA_RPC_URL }
