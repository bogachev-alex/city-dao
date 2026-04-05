/**
 * Contract PDA seed string: must match Anchor `register_contract` first arg
 * and stay within Solana's 32-byte UTF-8 seed limit (see useContractRegistry).
 */

const MAX_SEED_BYTES = 32

function shortStableHash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function normalizeContractTitleSeed(input: string): string {
  const raw = String(input || '').trim()
  const hashSuffix = `-${shortStableHash(raw)}`
  let out = raw
  while (Buffer.byteLength(out, 'utf8') > MAX_SEED_BYTES) {
    out = out.slice(0, -1)
  }
  if (out === raw) return out

  let pref = raw
  const budget = MAX_SEED_BYTES - Buffer.byteLength(hashSuffix, 'utf8')
  while (Buffer.byteLength(pref, 'utf8') > Math.max(1, budget)) {
    pref = pref.slice(0, -1)
  }
  return `${pref}${hashSuffix}`
}
