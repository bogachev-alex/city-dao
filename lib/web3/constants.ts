import { PublicKey } from '@solana/web3.js'

// Solana cluster
export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta'
export const SOLANA_NETWORK: SolanaCluster = 'devnet'
export const SOLANA_RPC_URL = 'https://api.devnet.solana.com'

// Program IDs — generated keypairs, will be active after `anchor deploy`
export const PROGRAM_IDS = {
  contractRegistry: new PublicKey('GGtDAGtHMRd6BxDGyoSXXVfevDDjhj8XnTnAYftnGmBU'),
  citizenRegistry: new PublicKey('Ckghe1MiBJEX9DLHHMqtXaczXQyCNHrimq9GixjFiyE6'),
  juryMechanism: new PublicKey('F2wfSrALyt3qqUrV7pP2XqCm6mLN8rPLQ5UDTXz3C68w'),
  penaltyEngine: new PublicKey('DBMPFjrt7aaiCh4s56wrsge2uMcu8zn9Wb7o6LE28E7z'),
  districtTreasury: new PublicKey('44SAVcK4BVrKQvX1WAgHPCcov1vBnNpMWhFbVJCziGwy'),
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
