import {
  Connection,
  Keypair,
  PublicKey,
  AccountMeta,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js'
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import { prisma } from '@/lib/prisma'
import idl from '@/lib/web3/idl/crowdfunding.json'
import { PROGRAM_IDS, SEEDS, SOLANA_RPC_URL } from '@/lib/web3/constants'

function loadRefundKeeperKeypair(): Keypair | null {
  const raw = process.env.CROWDFUNDING_REFUND_KEEPER_SECRET
  if (!raw?.trim()) return null
  try {
    const arr = JSON.parse(raw) as number[]
    if (!Array.isArray(arr) || arr.length < 32) return null
    return Keypair.fromSecretKey(Uint8Array.from(arr))
  } catch {
    return null
  }
}

function keeperWallet(keeper: Keypair): Wallet {
  return {
    publicKey: keeper.publicKey,
    signTransaction: async (tx) => {
      if (tx instanceof Transaction) tx.partialSign(keeper)
      else if (tx instanceof VersionedTransaction) tx.sign([keeper])
      return tx
    },
    signAllTransactions: async (txs) => {
      for (const t of txs) {
        if (t instanceof Transaction) t.partialSign(keeper)
        else if (t instanceof VersionedTransaction) t.sign([keeper])
      }
      return txs
    },
  } as Wallet
}

function isCampaignStatusActive(status: unknown): boolean {
  return typeof status === 'object' && status !== null && 'active' in status
}

/**
 * Runs on-chain refund_all for DB-active campaigns past deadline that are still Active on-chain,
 * then marks them EXPIRED. Relayer fees are paid from the creator's refund_exec_vault (closed to keeper).
 */
export async function runExpiredCrowdfundingRefunds(): Promise<{
  keeperConfigured: boolean
  processed: number
  skipped: number
  details: { campaignId: string; outcome: string }[]
}> {
  const keeper = loadRefundKeeperKeypair()
  if (!keeper) {
    return { keeperConfigured: false, processed: 0, skipped: 0, details: [] }
  }

  const rows = await prisma.crowdfundingCampaign.findMany({
    where: {
      onChainPubkey: { not: null },
      status: 'ACTIVE',
      deadline: { lt: new Date() },
    },
    select: { id: true, onChainPubkey: true },
  })

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
  const provider = new AnchorProvider(connection, keeperWallet(keeper), { commitment: 'confirmed' })
  const program = new Program(idl as never, provider)

  const details: { campaignId: string; outcome: string }[] = []
  let processed = 0
  let skipped = 0

  for (const row of rows) {
    const pkStr = row.onChainPubkey
    if (!pkStr) {
      skipped++
      details.push({ campaignId: row.id, outcome: 'skip_no_pubkey' })
      continue
    }

    let campaignPk: PublicKey
    try {
      campaignPk = new PublicKey(pkStr)
    } catch {
      skipped++
      details.push({ campaignId: row.id, outcome: 'skip_invalid_pubkey' })
      continue
    }

    try {
      const acc = await (program.account as any).crowdfundingCampaignAccount.fetch(campaignPk)
      if (!isCampaignStatusActive(acc.status)) {
        skipped++
        details.push({ campaignId: row.id, outcome: 'skip_chain_not_active' })
        continue
      }

      const now = Math.floor(Date.now() / 1000)
      const deadline = acc.deadline.toNumber()
      if (now <= deadline) {
        skipped++
        details.push({ campaignId: row.id, outcome: 'skip_deadline_not_passed' })
        continue
      }

      const raised = acc.citizenRaised.toNumber()
      const target = acc.citizenTarget.toNumber()
      if (raised >= target) {
        skipped++
        details.push({ campaignId: row.id, outcome: 'skip_target_reached' })
        continue
      }

      const [vault] = PublicKey.findProgramAddressSync(
        [SEEDS.cfRefundExec, campaignPk.toBuffer()],
        PROGRAM_IDS.crowdfunding
      )
      const vaultInfo = await connection.getAccountInfo(vault)
      if (!vaultInfo) {
        skipped++
        details.push({ campaignId: row.id, outcome: 'skip_no_refund_vault_legacy_campaign' })
        continue
      }

      const donorRows = await (program.account as any).donorRecord.all([
        { memcmp: { offset: 40, bytes: campaignPk.toBase58() } },
      ])

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [SEEDS.cfEscrow, campaignPk.toBuffer()],
        PROGRAM_IDS.crowdfunding
      )

      // Execute per-donor refunds. This avoids remaining_accounts size limits of refund_all and
      // allows idempotent progress even with many donors.
      let refundedAny = false
      for (const d of donorRows as { publicKey: PublicKey; account: { donor: PublicKey; lamports?: any } }[]) {
        const donorWallet = d.account.donor
        const donorLamports = Number(d.account.lamports ?? 0)
        if (!donorWallet || donorLamports <= 0) continue

        await (program.methods as any)
          .refundOne()
          .accounts({
            campaign: campaignPk,
            escrow: escrowPda,
            donorRecord: d.publicKey,
            donorWallet,
            refundExecVault: vault,
            caller: keeper.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        refundedAny = true
      }

      await prisma.crowdfundingCampaign.update({
        where: { id: row.id },
        data: { status: 'EXPIRED' },
      })

      processed++
      details.push({ campaignId: row.id, outcome: refundedAny ? 'refunded' : 'refunded_noop' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      skipped++
      details.push({ campaignId: row.id, outcome: `error:${msg.slice(0, 120)}` })
    }
  }

  return { keeperConfigured: true, processed, skipped, details }
}

export type CrowdfundingRefundKeeperDiagnostics = {
  cronSecretConfigured: boolean
  keeperSecretConfigured: boolean
  keeperKeypairValid: boolean
  keeperPublicKey: string | null
  keeperBalanceLamports: number | null
  rpcUrl: string
  rpcReachable: boolean
  parseError: string | null
  /** DB rows that match auto-refund candidate filter (may still be skipped on-chain). */
  dbExpiredActiveWithPubkeyCount: number
}

/**
 * Read-only checks for ops: env shape, keeper pubkey, RPC, balance (tx fees), queue size.
 * Does not run refund_all or expose secrets.
 */
export async function diagnoseCrowdfundingRefundKeeper(): Promise<CrowdfundingRefundKeeperDiagnostics> {
  const cronSecretConfigured = !!process.env.CRON_SECRET?.trim()
  const raw = process.env.CROWDFUNDING_REFUND_KEEPER_SECRET
  const keeperSecretConfigured = !!raw?.trim()
  const rpcUrl = SOLANA_RPC_URL

  let dbExpiredActiveWithPubkeyCount = 0
  try {
    dbExpiredActiveWithPubkeyCount = await prisma.crowdfundingCampaign.count({
      where: {
        onChainPubkey: { not: null },
        status: 'ACTIVE',
        deadline: { lt: new Date() },
      },
    })
  } catch {
    dbExpiredActiveWithPubkeyCount = -1
  }

  if (!keeperSecretConfigured) {
    return {
      cronSecretConfigured,
      keeperSecretConfigured: false,
      keeperKeypairValid: false,
      keeperPublicKey: null,
      keeperBalanceLamports: null,
      rpcUrl,
      rpcReachable: false,
      parseError: null,
      dbExpiredActiveWithPubkeyCount,
    }
  }

  try {
    const arr = JSON.parse(raw!) as number[]
    if (!Array.isArray(arr) || arr.length < 32) {
      return {
        cronSecretConfigured,
        keeperSecretConfigured: true,
        keeperKeypairValid: false,
        keeperPublicKey: null,
        keeperBalanceLamports: null,
        rpcUrl,
        rpcReachable: false,
        parseError: 'Expected JSON array of at least 32 byte values (secret key)',
        dbExpiredActiveWithPubkeyCount,
      }
    }
    const kp = Keypair.fromSecretKey(Uint8Array.from(arr))
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
    let rpcReachable = false
    let keeperBalanceLamports: number | null = null
    try {
      await connection.getSlot()
      rpcReachable = true
      keeperBalanceLamports = await connection.getBalance(kp.publicKey)
    } catch {
      rpcReachable = false
    }
    return {
      cronSecretConfigured,
      keeperSecretConfigured: true,
      keeperKeypairValid: true,
      keeperPublicKey: kp.publicKey.toBase58(),
      keeperBalanceLamports,
      rpcUrl,
      rpcReachable,
      parseError: null,
      dbExpiredActiveWithPubkeyCount,
    }
  } catch (e) {
    return {
      cronSecretConfigured,
      keeperSecretConfigured: true,
      keeperKeypairValid: false,
      keeperPublicKey: null,
      keeperBalanceLamports: null,
      rpcUrl,
      rpcReachable: false,
      parseError: e instanceof Error ? e.message : String(e),
      dbExpiredActiveWithPubkeyCount,
    }
  }
}
