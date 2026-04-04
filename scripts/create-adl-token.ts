/**
 * One-time script: creates the ADL (Adal Coin) SPL token mint on devnet.
 *
 * Step 1 — generate keypair and save to .env.local, then fund via web faucet:
 *   npx tsx scripts/create-adl-token.ts
 *
 * Step 2 — after funding, run again to create the mint:
 *   npx tsx scripts/create-adl-token.ts
 */

import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { createMint } from '@solana/spl-token'

dotenv.config({ path: '.env.local' })

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const ENV_FILE = path.resolve('.env.local')

function appendEnv(key: string, value: string) {
  const current = fs.readFileSync(ENV_FILE, 'utf-8')
  if (current.includes(key + '=')) {
    // Replace existing line
    const updated = current.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`)
    fs.writeFileSync(ENV_FILE, updated)
  } else {
    fs.appendFileSync(ENV_FILE, `\n${key}=${value}\n`)
  }
}

async function main() {
  const connection = new Connection(RPC, 'confirmed')

  // Load or generate mint authority keypair
  let mintAuthority: Keypair
  const existingKey = process.env.ADL_MINT_AUTHORITY_SECRET_KEY
  if (existingKey) {
    mintAuthority = Keypair.fromSecretKey(Buffer.from(existingKey, 'base64'))
    console.log('Reusing existing mint authority:', mintAuthority.publicKey.toBase58())
  } else {
    mintAuthority = Keypair.generate()
    const secretBase64 = Buffer.from(mintAuthority.secretKey).toString('base64')
    appendEnv('ADL_MINT_AUTHORITY_SECRET_KEY', secretBase64)
    console.log('Generated and saved mint authority:', mintAuthority.publicKey.toBase58())
    console.log('ADL_MINT_AUTHORITY_SECRET_KEY written to .env.local')
  }

  // Check balance
  const balance = await connection.getBalance(mintAuthority.publicKey)
  console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL')

  if (balance < 0.05 * LAMPORTS_PER_SOL) {
    console.log('\n⚠ Not enough SOL. Fund this address on devnet:')
    console.log('\n  ', mintAuthority.publicKey.toBase58())
    console.log('\nOptions:')
    console.log('  • https://faucet.solana.com  (paste address, select Devnet)')
    console.log('  • solana airdrop 1 <address> --url devnet')
    console.log('\nThen run this script again.')
    process.exit(0)
  }

  // Check if mint already created
  if (process.env.NEXT_PUBLIC_ADL_MINT) {
    console.log('\n✓ ADL mint already exists:', process.env.NEXT_PUBLIC_ADL_MINT)
    console.log('Delete NEXT_PUBLIC_ADL_MINT from .env.local to recreate.')
    process.exit(0)
  }

  // Create ADL mint: 0 decimals, no freeze authority
  console.log('\nCreating ADL mint on devnet...')
  const mint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    0,
  )

  appendEnv('NEXT_PUBLIC_ADL_MINT', mint.toBase58())
  console.log('\n✓ ADL token created!')
  console.log('Mint address:', mint.toBase58())
  console.log('NEXT_PUBLIC_ADL_MINT written to .env.local')
  console.log('\nRestart the dev server to pick up the new env vars.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
