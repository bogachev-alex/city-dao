#!/usr/bin/env node
/**
 * Writes programs/crowdfunding deploy keypair to target/deploy/crowdfunding-keypair.json
 * (Solana JSON byte array format). Run from repo `app/` root.
 *
 * Usage:
 *   node scripts/generate-crowdfunding-keypair.mjs
 *   node scripts/generate-crowdfunding-keypair.mjs --force   # overwrite existing
 */
import { Keypair } from '@solana/web3.js'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'target/deploy')
const outFile = join(outDir, 'crowdfunding-keypair.json')
const force = process.argv.includes('--force')

if (existsSync(outFile) && !force) {
  console.error(`Refusing to overwrite ${outFile} (use --force)`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
const kp = Keypair.generate()
writeFileSync(outFile, JSON.stringify(Array.from(kp.secretKey)), 'utf8')
console.log('Wrote:', outFile)
console.log('Program id (pubkey):', kp.publicKey.toBase58())
