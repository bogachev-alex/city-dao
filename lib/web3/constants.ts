import { PublicKey } from '@solana/web3.js'

// Solana cluster
export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta'
export const SOLANA_NETWORK: SolanaCluster = 'devnet'
// Force devnet for all wallet and RPC operations in this app.
// Override with NEXT_PUBLIC_SOLANA_RPC_URL for a paid endpoint (avoids public rate limits).
export const SOLANA_RPC_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SOLANA_RPC_URL) ||
  'https://api.devnet.solana.com'
/** Settlement token mint for contract economy (USDC on Solana). */
export const USDC_MINT = new PublicKey(
  // Devnet USDC mint (SPL test token).
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
)

// Program IDs — generated keypairs, will be active after `anchor deploy`
export const PROGRAM_IDS = {
  contractRegistry: new PublicKey('6E9SJu8QPEAoyuZRh9SBhVMtkYypFmgYsHFbJb792pz4'),
  citizenRegistry: new PublicKey('2Gjs7gsyaBayR38AACScCPz3ZgRf3JZvAoW63A5jKCd3'),
  juryMechanism: new PublicKey('HVZcSwtwNA2eJwEgimoDFTXe74pmGpvv1CDUXaEntzTd'),
  penaltyEngine: new PublicKey('9xYTKtPkMDJdVqm56f5ttx5XUgQU5S4nBLT3WHoSZxeT'),
  districtTreasury: new PublicKey('HtBdghVoWexYkmmpUaCc2NrpU2YQTSytyhvtSL4QCQdJ'),
  crowdfunding: new PublicKey('3vCqBvYEnXb1kW9CB4smrAMUzSrdTFfFv2XuMGw1Sdzj'),
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

// Tenge to lamports conversion (1 SOL = ~80 000 KZT)
const KZT_PER_SOL = 80_000
const LAMPORTS_PER_SOL = 1_000_000_000

export function tengeToLamports(tenge: number): number {
  return Math.round((tenge / KZT_PER_SOL) * LAMPORTS_PER_SOL)
}

export function lamportsToTenge(lamports: number): number {
  return Math.round((lamports / LAMPORTS_PER_SOL) * KZT_PER_SOL)
}
