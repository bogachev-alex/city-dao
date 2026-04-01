#!/usr/bin/env node
/**
 * Reads target/deploy/crowdfunding-keypair.json and updates program id in:
 *   programs/crowdfunding/src/lib.rs (declare_id!)
 *   Anchor.toml
 *   lib/web3/constants.ts
 *   lib/web3/idl/crowdfunding.json ("address")
 *
 * Run from `app/` after generate-crowdfunding-keypair.mjs
 */
import { Keypair } from '@solana/web3.js'
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const kpPath = join(root, 'target/deploy/crowdfunding-keypair.json')

const raw = JSON.parse(readFileSync(kpPath, 'utf8'))
const secret = Uint8Array.from(raw)
const kp = Keypair.fromSecretKey(secret)
const id = kp.publicKey.toBase58()

const libPath = join(root, 'programs/crowdfunding/src/lib.rs')
let lib = readFileSync(libPath, 'utf8')
lib = lib.replace(/declare_id!\("[1-9A-HJ-NP-Za-km-z]{32,44}"\);/, `declare_id!("${id}");`)
writeFileSync(libPath, lib, 'utf8')

let anchor = readFileSync(join(root, 'Anchor.toml'), 'utf8')
anchor = anchor.replace(/^crowdfunding = "[1-9A-HJ-NP-Za-km-z]{32,44}"$/m, `crowdfunding = "${id}"`)
writeFileSync(join(root, 'Anchor.toml'), anchor, 'utf8')

let constants = readFileSync(join(root, 'lib/web3/constants.ts'), 'utf8')
constants = constants.replace(
  /crowdfunding: new PublicKey\('[1-9A-HJ-NP-Za-km-z]{32,44}'\)/,
  `crowdfunding: new PublicKey('${id}')`
)
writeFileSync(join(root, 'lib/web3/constants.ts'), constants, 'utf8')

const idlPath = join(root, 'lib/web3/idl/crowdfunding.json')
let idl = readFileSync(idlPath, 'utf8')
idl = idl.replace(/^  "address": "[1-9A-HJ-NP-Za-km-z]{32,44}",$/m, `  "address": "${id}",`)
writeFileSync(idlPath, idl, 'utf8')

console.log('Synced program id to Rust, Anchor.toml, constants.ts, IDL:', id)
