/**
 * Seed Solana devnet with demo data.
 *
 * Writes DEMO_CONTRACTS to chain as real GovernmentContract accounts,
 * initializes district treasuries, and registers demo citizens.
 *
 * Usage:
 *   npx tsx scripts/seed-devnet.ts
 *
 * Prerequisites:
 *   - Solana CLI configured for devnet: solana config set --url devnet
 *   - Deploy keypair with SOL: solana airdrop 5
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

// Program IDs (must match Anchor.toml / constants.ts)
const PROGRAM_IDS = {
  contractRegistry: new PublicKey('6E9SJu8QPEAoyuZRh9SBhVMtkYypFmgYsHFbJb792pz4'),
  citizenRegistry: new PublicKey('2Gjs7gsyaBayR38AACScCPz3ZgRf3JZvAoW63A5jKCd3'),
  districtTreasury: new PublicKey('HtBdghVoWexYkmmpUaCc2NrpU2YQTSytyhvtSL4QCQdJ'),
}

// PDA seeds (must match programs)
const SEEDS = {
  contract: Buffer.from('contract'),
  escrow: Buffer.from('escrow'),
  citizen: Buffer.from('citizen'),
  treasury: Buffer.from('treasury'),
}

// Almaty districts
const DISTRICTS = [
  'Алатауский',
  'Алмалинский',
  'Ауэзовский',
  'Бостандыкский',
  'Жетысуский',
  'Медеуский',
  'Наурызбайский',
  'Турксибский',
]

// Demo contracts matching DEMO_CONTRACTS in lib/contracts.ts
// PDA seed limit: 32 bytes per component. Cyrillic = 2 bytes/char → max ~16 chars.
// Amounts in lamports — small values for devnet demo (1 SOL = 1B lamports).
// Using 0.01 SOL per contract so seed doesn't drain the wallet.
const LAMPORTS_SCALE = 10_000_000 // 0.01 SOL per unit

const SEED_CONTRACTS = [
  {
    title: 'Vesnovka-01',
    district: 'Медеуский',
    totalAmount: 45 * LAMPORTS_SCALE,
    deadlineDays: 21,
    lat: 43.2711,
    lng: 76.9388,
    milestones: [
      { description: 'Phase 1', deadlineDays: 3, tranchePct: 25 },
      { description: 'Phase 2', deadlineDays: 6, tranchePct: 50 },
      { description: 'Phase 3', deadlineDays: 10, tranchePct: 25 },
    ],
  },
  {
    title: 'Yassaui-02',
    district: 'Ауэзовский',
    totalAmount: 12 * LAMPORTS_SCALE,
    deadlineDays: -5,
    lat: 43.2395,
    lng: 76.8742,
    milestones: [
      { description: 'Phase 1', deadlineDays: 2, tranchePct: 30 },
      { description: 'Phase 2', deadlineDays: 5, tranchePct: 70 },
    ],
  },
  {
    title: 'Akzhar-03',
    district: 'Наурызбайский',
    totalAmount: 38 * LAMPORTS_SCALE,
    deadlineDays: 35,
    lat: 43.1897,
    lng: 76.8456,
    milestones: [
      { description: 'Phase 1', deadlineDays: 5, tranchePct: 10 },
      { description: 'Phase 2', deadlineDays: 15, tranchePct: 30 },
      { description: 'Phase 3', deadlineDays: 25, tranchePct: 40 },
      { description: 'Phase 4', deadlineDays: 35, tranchePct: 20 },
    ],
  },
  {
    title: 'Kuramys-04',
    district: 'Бостандыкский',
    totalAmount: 25 * LAMPORTS_SCALE,
    deadlineDays: 60,
    lat: 43.2156,
    lng: 76.8892,
    milestones: [
      { description: 'Phase 1', deadlineDays: 20, tranchePct: 30 },
      { description: 'Phase 2', deadlineDays: 40, tranchePct: 40 },
      { description: 'Phase 3', deadlineDays: 60, tranchePct: 30 },
    ],
  },
]

// Demo citizen IIN hashes (SHA-256 of test IINs)
const DEMO_CITIZENS = [
  { district: 'Медеуский', iinHash: new Uint8Array(32).fill(1) },
  { district: 'Ауэзовский', iinHash: new Uint8Array(32).fill(2) },
  { district: 'Бостандыкский', iinHash: new Uint8Array(32).fill(3) },
]

// ─── Helpers ───

function loadKeypair(filepath: string): Keypair {
  const raw = fs.readFileSync(filepath, 'utf-8')
  const secretKey = Uint8Array.from(JSON.parse(raw))
  return Keypair.fromSecretKey(secretKey)
}

function loadIdl(name: string): any {
  const idlPath = path.join(__dirname, '..', 'lib', 'web3', 'idl', `${name}.json`)
  return JSON.parse(fs.readFileSync(idlPath, 'utf-8'))
}

function getContractPDA(authority: PublicKey, title: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.contract, authority.toBuffer(), Buffer.from(title)],
    PROGRAM_IDS.contractRegistry,
  )
}

function getEscrowPDA(contractPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.escrow, contractPDA.toBuffer()],
    PROGRAM_IDS.contractRegistry,
  )
}

function getTreasuryPDA(district: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.treasury, Buffer.from(district)],
    PROGRAM_IDS.districtTreasury,
  )
}

function getCitizenPDA(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.citizen, wallet.toBuffer()],
    PROGRAM_IDS.citizenRegistry,
  )
}

async function accountExists(connection: Connection, pubkey: PublicKey): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey)
  return info !== null
}

// ─── Main ───

async function main() {
  console.log('🚀 Amanat Protocol — Devnet Seed Script')
  console.log(`   RPC: ${RPC_URL}`)
  console.log(`   Wallet: ${WALLET_PATH}`)
  console.log()

  // Load wallet
  const keypair = loadKeypair(WALLET_PATH)
  const wallet = new Wallet(keypair)
  console.log(`   Authority: ${keypair.publicKey.toBase58()}`)

  // Connect
  const connection = new Connection(RPC_URL, 'confirmed')
  const balance = await connection.getBalance(keypair.publicKey)
  console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(2)} SOL`)

  if (balance < LAMPORTS_PER_SOL) {
    console.log('⚠️  Low balance. Requesting airdrop...')
    const sig = await connection.requestAirdrop(keypair.publicKey, 5 * LAMPORTS_PER_SOL)
    await connection.confirmTransaction(sig, 'confirmed')
    console.log('   Airdrop received: 5 SOL')
  }

  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })

  // Load programs
  const contractIdl = loadIdl('contract_registry')
  const citizenIdl = loadIdl('citizen_registry')
  const treasuryIdl = loadIdl('district_treasury')

  const contractProgram = new Program(contractIdl, provider)
  const citizenProgram = new Program(citizenIdl, provider)
  const treasuryProgram = new Program(treasuryIdl, provider)

  // Generate a dummy contractor keypair for demo
  const contractor = Keypair.generate()

  // ─── 1. Initialize District Treasuries ───
  console.log('\n📦 Initializing district treasuries...')
  for (const district of DISTRICTS) {
    const [treasuryPDA] = getTreasuryPDA(district)
    if (await accountExists(connection, treasuryPDA)) {
      console.log(`   ✓ ${district} — already exists`)
      continue
    }

    try {
      const tx = await (treasuryProgram.methods as any)
        .initTreasury(district)
        .accounts({
          districtTreasury: treasuryPDA,
          authority: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      console.log(`   ✓ ${district} — ${tx.slice(0, 12)}...`)
    } catch (err: any) {
      console.error(`   ✗ ${district} — ${err.message}`)
    }
  }

  // ─── 2. Register Demo Contracts ───
  console.log('\n📋 Registering demo contracts...')
  for (const c of SEED_CONTRACTS) {
    const [contractPDA] = getContractPDA(keypair.publicKey, c.title)
    const [escrowPDA] = getEscrowPDA(contractPDA)

    if (await accountExists(connection, contractPDA)) {
      console.log(`   ✓ "${c.title}" — already exists`)
      continue
    }

    const now = Math.floor(Date.now() / 1000)
    const deadline = now + c.deadlineDays * 86400

    const milestoneInputs = c.milestones.map((m) => ({
      description: m.description,
      deadlineDays: m.deadlineDays,
      tranchePct: m.tranchePct,
    }))

    try {
      const tx = await (contractProgram.methods as any)
        .registerContract(
          c.title,
          c.district,
          new BN(c.totalAmount),
          new BN(deadline),
          milestoneInputs,
          c.lat,
          c.lng,
        )
        .accounts({
          governmentContract: contractPDA,
          escrow: escrowPDA,
          contractor: contractor.publicKey,
          authority: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      console.log(`   ✓ "${c.title}" — ${tx.slice(0, 12)}...`)
    } catch (err: any) {
      console.error(`   ✗ "${c.title}" — ${err.message}`)
    }
  }

  // ─── 3. Register Demo Citizens ───
  console.log('\n👤 Registering demo citizens...')
  for (let i = 0; i < DEMO_CITIZENS.length; i++) {
    const { district, iinHash } = DEMO_CITIZENS[i]
    // Generate unique keypair per demo citizen
    const citizenKeypair = Keypair.generate()
    const [citizenPDA] = getCitizenPDA(citizenKeypair.publicKey)

    // Fund citizen wallet (needs SOL to pay for account creation)
    try {
      const fundTx = await connection.requestAirdrop(citizenKeypair.publicKey, 0.1 * LAMPORTS_PER_SOL)
      await connection.confirmTransaction(fundTx, 'confirmed')
    } catch {
      console.log(`   ⚠ Airdrop to citizen #${i + 1} failed — skipping`)
      continue
    }

    const citizenWallet = new Wallet(citizenKeypair)
    const citizenProvider = new AnchorProvider(connection, citizenWallet, { commitment: 'confirmed' })
    const citizenProg = new Program(citizenIdl, citizenProvider)

    try {
      const tx = await (citizenProg.methods as any)
        .registerCitizen(district, Array.from(iinHash))
        .accounts({
          citizenProfile: citizenPDA,
          wallet: citizenKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      console.log(`   ✓ Citizen #${i + 1} (${district}) — ${tx.slice(0, 12)}...`)
    } catch (err: any) {
      console.error(`   ✗ Citizen #${i + 1} — ${err.message}`)
    }
  }

  // ─── Summary ───
  console.log('\n✅ Seed complete!')
  console.log(`   Contracts: ${SEED_CONTRACTS.length}`)
  console.log(`   Districts: ${DISTRICTS.length}`)
  console.log(`   Citizens: ${DEMO_CITIZENS.length}`)
  console.log(`\n   View on Explorer: https://explorer.solana.com/address/${keypair.publicKey.toBase58()}?cluster=devnet`)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
