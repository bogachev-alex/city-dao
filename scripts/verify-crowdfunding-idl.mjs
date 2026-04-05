#!/usr/bin/env node
/**
 * Verifies instruction/account/event discriminators in lib/web3/idl/crowdfunding.json
 * match Anchor's sha256("global:" | "account:" | "event:" + name)[0..8].
 * Run: node scripts/verify-crowdfunding-idl.mjs
 */
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const idlPath = join(__dirname, '../lib/web3/idl/crowdfunding.json')
const idl = JSON.parse(readFileSync(idlPath, 'utf8'))

function disc(prefix, name) {
  const h = createHash('sha256').update(prefix + name).digest()
  return Array.from(h.subarray(0, 8))
}

let ok = true
for (const ix of idl.instructions) {
  const want = disc('global:', ix.name)
  const got = ix.discriminator
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    console.error(`IX ${ix.name}: expected ${JSON.stringify(want)} got ${JSON.stringify(got)}`)
    ok = false
  }
}
for (const a of idl.accounts || []) {
  const want = disc('account:', a.name)
  const got = a.discriminator
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    console.error(`ACC ${a.name}: expected ${JSON.stringify(want)} got ${JSON.stringify(got)}`)
    ok = false
  }
}
for (const e of idl.events || []) {
  const want = disc('event:', e.name)
  const got = e.discriminator
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    console.error(`EVT ${e.name}: expected ${JSON.stringify(want)} got ${JSON.stringify(got)}`)
    ok = false
  }
}

if (!ok) process.exit(1)
console.log('crowdfunding.json discriminators OK (Anchor sha256 prefixes).')
