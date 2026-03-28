import { PublicKey } from '@solana/web3.js'

// Solana cluster
export const SOLANA_NETWORK = 'devnet'
export const SOLANA_RPC_URL = 'https://api.devnet.solana.com'

// Program IDs — generated keypairs, will be active after `anchor deploy`
export const PROGRAM_IDS = {
  contractRegistry: new PublicKey('GGtDAGtHMRd6BxDGyoSXXVfevDDjhj8XnTnAYftnGmBU'),
  citizenRegistry: new PublicKey('Ckghe1MiBJEX9DLHHMqtXaczXQyCNHrimq9GixjFiyE6'),
  juryMechanism: new PublicKey('F2wfSrALyt3qqUrV7pP2XqCm6mLN8rPLQ5UDTXz3C68w'),
  penaltyEngine: new PublicKey('DBMPFjrt7aaiCh4s56wrsge2uMcu8zn9Wb7o6LE28E7z'),
  districtTreasury: new PublicKey('44SAVcK4BVrKQvX1WAgHPCcov1vBnNpMWhFbVJCziGwy'),
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
