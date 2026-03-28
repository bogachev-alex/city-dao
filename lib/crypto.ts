/**
 * Client-side SHA-256 hashing using the Web Crypto API.
 * Used for hashing IIN (Individual Identification Number) before storage.
 */
export async function hashIIN(iin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(iin.trim()) as unknown as ArrayBuffer
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Generate a random salt for jury vote commitment
 */
export function generateSalt(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Hash a vote commitment: SHA-256(vote + salt)
 */
export async function hashVoteCommitment(vote: 'accept' | 'reject', salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${vote}:${salt}`) as unknown as ArrayBuffer
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
