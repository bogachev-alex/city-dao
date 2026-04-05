import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from './idl/district_treasury.json'
import { PROGRAM_IDS, SEEDS, SOLANA_RPC_URL } from './constants'

const READ_ONLY_WALLET = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error('read-only')
  },
  signAllTransactions: async () => {
    throw new Error('read-only')
  },
} as const

export function getReadOnlySolanaConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, 'confirmed')
}

/**
 * Reads `DistrictTreasuryAccount.balance` (u64) from chain — same units as the program state.
 * Returns null if the account is missing or RPC/decode fails.
 */
export async function fetchDistrictTreasuryBalanceOnChain(
  connection: Connection,
  district: string
): Promise<bigint | null> {
  try {
    const provider = new AnchorProvider(connection, READ_ONLY_WALLET as any, {
      commitment: 'confirmed',
    })
    const program = new Program(idl as any, provider)
    const [treasuryPDA] = PublicKey.findProgramAddressSync(
      [SEEDS.treasury, Buffer.from(district)],
      PROGRAM_IDS.districtTreasury
    )
    const acc = await (program.account as any).districtTreasuryAccount.fetch(treasuryPDA)
    const raw = acc?.balance
    if (raw == null) return null
    const s =
      typeof raw === 'object' && raw !== null && 'toString' in raw
        ? (raw as { toString: () => string }).toString()
        : String(raw)
    return BigInt(s)
  } catch {
    return null
  }
}
