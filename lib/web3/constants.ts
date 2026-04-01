import { PublicKey } from '@solana/web3.js'

// Solana cluster
export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta'
export const SOLANA_NETWORK: SolanaCluster = 'devnet'
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// Program IDs — generated keypairs, will be active after `anchor deploy`
export const PROGRAM_IDS = {
  contractRegistry: new PublicKey('6E9SJu8QPEAoyuZRh9SBhVMtkYypFmgYsHFbJb792pz4'),
  citizenRegistry: new PublicKey('2Gjs7gsyaBayR38AACScCPz3ZgRf3JZvAoW63A5jKCd3'),
  juryMechanism: new PublicKey('HVZcSwtwNA2eJwEgimoDFTXe74pmGpvv1CDUXaEntzTd'),
  penaltyEngine: new PublicKey('9xYTKtPkMDJdVqm56f5ttx5XUgQU5S4nBLT3WHoSZxeT'),
  districtTreasury: new PublicKey('HtBdghVoWexYkmmpUaCc2NrpU2YQTSytyhvtSL4QCQdJ'),
  crowdfunding: new PublicKey('CRWDaH7ByG5BKmoCRestxNP7k4gSWgrWQVKLhf5VQ8mZ'),
} as const

// PDA seeds
export const SEEDS = {
  citizen: Buffer.from('citizen'),
  contract: Buffer.from('contract'),
  escrow: Buffer.from('escrow'),
  jury: Buffer.from('jury'),
  vote: Buffer.from('vote'),
  penalty: Buffer.from('penalty'),
  treasury: Buffer.from('treasury'),
  proposal: Buffer.from('proposal'),
  ballot: Buffer.from('ballot'),
  campaign: Buffer.from('campaign'),
  cfEscrow: Buffer.from('cf_escrow'),
  donor: Buffer.from('donor'),
} as const

// Almaty districts
export const DISTRICTS = [
  'Алатауский',
  'Алмалинский',
  'Ауэзовский',
  'Бостандыкский',
  'Жетысуский',
  'Медеуский',
  'Наурызбайский',
  'Турксибский',
] as const
