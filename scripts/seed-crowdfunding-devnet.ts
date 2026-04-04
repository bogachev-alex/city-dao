/**
 * Seed Solana devnet with demo crowdfunding campaigns.
 *
 * Creates CrowdfundingCampaignAccount PDAs for all 6 demo campaigns
 * (using the authority keypair as creator), then updates onChainPubkey
 * in the database via the local API.
 *
 * Usage:
 *   npx tsx scripts/seed-crowdfunding-devnet.ts
 *
 * Prerequisites:
 *   - Dev server running on localhost:3000
 *   - Solana CLI configured for devnet
 *   - Programs deployed: anchor deploy
 */

import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { AnchorProvider, Program, BN, Wallet } from '@coral-xyz/anchor'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ─── Config ───

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const WALLET_PATH = process.env.SOLANA_WALLET || path.join(os.homedir(), '.config/solana/id.json')
const API_BASE = process.env.API_BASE || 'http://localhost:3000'

const CROWDFUNDING_PROGRAM_ID = new PublicKey('3Mvy26WHuEW2X1Nwt9Ve6b4n5yEEwRPrLi7ie3tCo2MY')

const MIN_REFUND_EXEC_DEPOSIT = 1_000_000

const SEEDS = {
  campaign: Buffer.from('campaign'),
  cfEscrow: Buffer.from('cf_escrow'),
  cfRefundExec: Buffer.from('cf_refund_exec'),
}

// Category mapping: DB value → Anchor enum format
const CATEGORY_MAP: Record<string, object> = {
  PLAYGROUND: { playground: {} },
  SCHOOL: { school: {} },
  ROADS: { roads: {} },
  LANDSCAPING: { landscaping: {} },
  COMMERCIAL: { commercial: {} },
}

// KZT → lamports (1 SOL ≈ 80 000 KZT)
const KZT_PER_SOL = 80_000
function tengeToLamports(tenge: number): number {
  return Math.round((tenge / KZT_PER_SOL) * LAMPORTS_PER_SOL)
}

// Truncate title to 32 bytes (Solana PDA seed limit)
function normalizeSeedTitle(input: string): string {
  let out = input
  while (Buffer.byteLength(out, 'utf8') > 32) {
    out = out.slice(0, -1)
  }
  return out
}

// Demo campaigns — synced with DB seed (prisma/seed.ts)
const CAMPAIGNS = [
  {
    id: 'cmnbhlv5m006k74uzf0cwvv3d',
    title: 'Установка камер видеонаблюдения (мкр. Орбита-2)',
    description: 'Монтаж 20 камер видеонаблюдения на ключевых точках микрорайона. Интеграция с системой «Сергек».',
    district: 'Бостандыкский',
    category: 'COMMERCIAL',
    targetAmount: 4_800_000,
    deadline: new Date('2026-06-26').getTime() / 1000, // extended for demo
    lat: 43.2256,
    lng: 76.8992,
  },
  {
    id: 'cmnbhlv5k006j74uzbfv7b3l1',
    title: 'Освещение пешеходной аллеи вдоль р. Есентай',
    description: 'Установка 35 LED-фонарей вдоль пешеходной аллеи протяжённостью 1.5 км.',
    district: 'Медеуский',
    category: 'LANDSCAPING',
    targetAmount: 9_200_000,
    deadline: new Date('2026-07-26').getTime() / 1000,
    lat: 43.2311,
    lng: 76.9488,
  },
  {
    id: 'cmnbhlv5j006i74uz6t4dnfq9',
    title: 'Ремонт спортзала школы №92 (мкр. Алгабас)',
    description: 'Капитальный ремонт спортивного зала: замена полового покрытия, освещение (LED), вентиляция.',
    district: 'Алатауский',
    category: 'SCHOOL',
    targetAmount: 12_000_000,
    deadline: new Date('2026-07-20').getTime() / 1000,
    lat: 43.1897,
    lng: 76.8456,
  },
  {
    id: 'cmnbhlv5i006h74uzuatfy6vd',
    title: 'Озеленение сквера на пересечении Абая и Байтурсынова',
    description: 'Высадка 40 деревьев и 200 кустарников, установка системы капельного полива, газон 2000 м².',
    district: 'Алмалинский',
    category: 'LANDSCAPING',
    targetAmount: 6_000_000,
    deadline: new Date('2026-07-03').getTime() / 1000,
    lat: 43.2401,
    lng: 76.9198,
  },
  {
    id: 'cmnbhlv5f006g74uzj4gyzfzc',
    title: 'Ремонт тротуара по ул. Жандосова (от Манаса до Тимирязева)',
    description: 'Замена разрушенной тротуарной плитки на участке 1.2 км.',
    district: 'Бостандыкский',
    category: 'ROADS',
    targetAmount: 15_000_000,
    deadline: new Date('2026-08-02').getTime() / 1000,
    lat: 43.2156,
    lng: 76.8892,
  },
  {
    id: 'cmnbhlv5e006f74uzc1yuhsi7',
    title: 'Детская площадка во дворе ЖК «Алтын Булак»',
    description: 'Установка современной детской площадки с безопасным покрытием для детей 3–12 лет.',
    district: 'Ауэзовский',
    category: 'PLAYGROUND',
    targetAmount: 8_500_000,
    deadline: new Date('2026-07-16').getTime() / 1000,
    lat: 43.2395,
    lng: 76.8742,
  },
]

// ─── Helpers ───

function loadKeypair(filepath: string): Keypair {
  const raw = fs.readFileSync(filepath, 'utf-8')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
}

function loadIdl(name: string): any {
  const idlPath = path.join(__dirname, '..', 'lib', 'web3', 'idl', `${name}.json`)
  return JSON.parse(fs.readFileSync(idlPath, 'utf-8'))
}

function getCampaignPDA(creator: PublicKey, title: string): [PublicKey, number] {
  const seedTitle = normalizeSeedTitle(title)
  return PublicKey.findProgramAddressSync(
    [SEEDS.campaign, creator.toBuffer(), Buffer.from(seedTitle)],
    CROWDFUNDING_PROGRAM_ID,
  )
}

function getEscrowPDA(campaign: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.cfEscrow, campaign.toBuffer()],
    CROWDFUNDING_PROGRAM_ID,
  )
}

function getRefundExecVaultPDA(campaign: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.cfRefundExec, campaign.toBuffer()],
    CROWDFUNDING_PROGRAM_ID,
  )
}

async function accountExists(connection: Connection, pubkey: PublicKey): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey)
  return info !== null
}

async function setOnChainPubkey(campaignId: string, onChainPubkey: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/crowdfunding/${campaignId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_onchain', onChainPubkey }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
}

// ─── Main ───

async function main() {
  console.log('🚀 Amanat Protocol — Crowdfunding Devnet Seed')
  console.log(`   RPC: ${RPC_URL}`)
  console.log(`   Wallet: ${WALLET_PATH}`)
  console.log(`   API: ${API_BASE}`)
  console.log()

  const keypair = loadKeypair(WALLET_PATH)
  const wallet = new Wallet(keypair)
  console.log(`   Authority (creator): ${keypair.publicKey.toBase58()}`)

  const connection = new Connection(RPC_URL, 'confirmed')
  const balance = await connection.getBalance(keypair.publicKey)
  console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL`)

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log('⚠️  Low balance. Requesting airdrop...')
    const sig = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL)
    await connection.confirmTransaction(sig, 'confirmed')
    console.log('   Airdrop received: 2 SOL')
  }

  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  const idl = loadIdl('crowdfunding')
  const program = new Program(idl, provider)

  console.log('\n🎯 Creating crowdfunding campaigns on-chain...\n')

  let created = 0
  let skipped = 0
  let failed = 0

  for (const c of CAMPAIGNS) {
    const seedTitle = normalizeSeedTitle(c.title)
    const [campaignPDA] = getCampaignPDA(keypair.publicKey, seedTitle)
    const [escrowPDA] = getEscrowPDA(campaignPDA)
    const [refundVaultPDA] = getRefundExecVaultPDA(campaignPDA)
    const pda = campaignPDA.toBase58()

    const shortTitle = c.title.length > 45 ? c.title.slice(0, 45) + '…' : c.title
    process.stdout.write(`   "${shortTitle}"\n`)
    process.stdout.write(`   PDA: ${pda}\n`)

    if (await accountExists(connection, campaignPDA)) {
      process.stdout.write(`   ✓ already on-chain — updating DB...\n`)
      try {
        await setOnChainPubkey(c.id, pda)
        process.stdout.write(`   ✓ DB updated\n\n`)
        skipped++
      } catch (err: any) {
        process.stdout.write(`   ✗ DB update failed: ${err.message}\n\n`)
        failed++
      }
      continue
    }

    const category = CATEGORY_MAP[c.category]
    if (!category) {
      process.stdout.write(`   ✗ Unknown category: ${c.category}\n\n`)
      failed++
      continue
    }

    try {
      const tx = await (program.methods as any)
        .initCampaign(
          seedTitle,
          c.description,
          c.district,
          category,
          new BN(tengeToLamports(c.targetAmount)),
          new BN(Math.floor(c.deadline)),
          c.lat,
          c.lng,
          new BN(MIN_REFUND_EXEC_DEPOSIT),
        )
        .accounts({
          campaign: campaignPDA,
          escrow: escrowPDA,
          refundExecVault: refundVaultPDA,
          creator: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      process.stdout.write(`   ✓ tx: ${tx.slice(0, 16)}...\n`)

      await setOnChainPubkey(c.id, pda)
      process.stdout.write(`   ✓ DB updated: onChainPubkey = ${pda.slice(0, 12)}...\n\n`)
      created++
    } catch (err: any) {
      process.stdout.write(`   ✗ Failed: ${err.message?.slice(0, 120)}\n\n`)
      failed++
    }
  }

  const finalBalance = await connection.getBalance(keypair.publicKey)
  console.log('─'.repeat(60))
  console.log(`✅ Done!`)
  console.log(`   Created: ${created}  |  Skipped (already existed): ${skipped}  |  Failed: ${failed}`)
  console.log(`   SOL spent: ${((balance - finalBalance) / LAMPORTS_PER_SOL).toFixed(4)}`)
  console.log(`\n   Explorer: https://explorer.solana.com/address/${keypair.publicKey.toBase58()}?cluster=devnet`)
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err)
  process.exit(1)
})
