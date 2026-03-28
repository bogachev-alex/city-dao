/**
 * Initialize on-chain treasuries and proposals from PostgreSQL data.
 * Run: npx tsx scripts/init-onchain.ts
 */
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import * as fs from 'fs'
import * as path from 'path'

const SOLANA_RPC = 'https://api.devnet.solana.com'
const PROGRAM_ID = new PublicKey('44SAVcK4BVrKQvX1WAgHPCcov1vBnNpMWhFbVJCziGwy')
const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'district_treasury.json')
const WALLET_PATH = path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'solana', 'id.json')

async function main() {
  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8')))
  )
  console.log('Wallet:', walletKeypair.publicKey.toBase58())

  // Setup connection + provider
  const connection = new Connection(SOLANA_RPC, 'confirmed')
  const balance = await connection.getBalance(walletKeypair.publicKey)
  console.log('Balance:', balance / 1e9, 'SOL')

  const wallet = new Wallet(walletKeypair)
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })

  // Load IDL
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, 'utf-8'))
  const program = new Program(idl as any, provider)

  // Get all proposals from our API
  const API = 'http://localhost:3000'
  const treasuries = await fetch(`${API}/api/treasury`).then(r => r.json())

  console.log(`\nFound ${treasuries.length} districts\n`)

  // Init treasuries
  for (const t of treasuries) {
    const [treasuryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), Buffer.from(t.district)],
      PROGRAM_ID
    )

    // Check if already exists
    const info = await connection.getAccountInfo(treasuryPDA)
    if (info) {
      console.log(`✓ Treasury ${t.district} already exists: ${treasuryPDA.toBase58()}`)
    } else {
      try {
        const tx = await (program.methods as any)
          .initTreasury(t.district)
          .accounts({
            districtTreasury: treasuryPDA,
            authority: walletKeypair.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        console.log(`✓ Treasury ${t.district} initialized: ${tx}`)
      } catch (err: any) {
        console.log(`✗ Treasury ${t.district} failed: ${err.message?.slice(0, 100)}`)
      }
    }

    // Get full treasury with proposals
    const full = await fetch(`${API}/api/treasury/${encodeURIComponent(t.district)}`).then(r => r.json())

    // Init proposals
    for (const p of full.proposals || []) {
      // PDA seed max 32 bytes per component. Use first 32 bytes of title.
      const titleBytes = Buffer.from(p.title)
      const titleSeed = titleBytes.length <= 32 ? titleBytes : titleBytes.subarray(0, 32)
      const [proposalPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal'), treasuryPDA.toBuffer(), titleSeed],
        PROGRAM_ID
      )

      const pInfo = await connection.getAccountInfo(proposalPDA)
      if (pInfo) {
        console.log(`  ✓ Proposal "${p.title.slice(0, 40)}..." already exists`)
      } else {
        try {
          const tx = await (program.methods as any)
            .createProposal(
              p.title,
              p.description || '',
              BigInt(p.amount),
              p.category || 'Общее',
            )
            .accounts({
              districtTreasury: treasuryPDA,
              spendingProposal: proposalPDA,
              proposer: walletKeypair.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc()
          console.log(`  ✓ Proposal "${p.title.slice(0, 40)}..." created: ${tx.slice(0, 20)}...`)
        } catch (err: any) {
          console.log(`  ✗ Proposal "${p.title.slice(0, 40)}..." failed: ${err.message?.slice(0, 120)}`)
        }
      }
    }
  }

  const finalBalance = await connection.getBalance(walletKeypair.publicKey)
  console.log(`\nDone! Balance: ${finalBalance / 1e9} SOL (spent ${(balance - finalBalance) / 1e9} SOL)`)
}

main().catch(console.error)
