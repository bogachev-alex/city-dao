import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import contractRegistryIdl from './idl/contract_registry.json'
import { getReadOnlySolanaConnection } from './fetchDistrictTreasuryBalance'

const READ_ONLY_WALLET = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error('read-only')
  },
  signAllTransactions: async () => {
    throw new Error('read-only')
  },
} as const

/** Count of `GovernmentContract` accounts on-chain (matches реестр в режиме Solana). */
export async function fetchGovernmentContractsOnChainCount(
  connection?: Connection
): Promise<number | null> {
  const conn = connection || getReadOnlySolanaConnection()
  try {
    const provider = new AnchorProvider(conn, READ_ONLY_WALLET as any, {
      commitment: 'confirmed',
    })
    const program = new Program(contractRegistryIdl as any, provider)
    const accounts = await (program.account as any).governmentContract.all()
    return accounts.length
  } catch {
    return null
  }
}
