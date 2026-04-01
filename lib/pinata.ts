/**
 * Pinata IPFS integration for milestone evidence uploads.
 *
 * Evidence photos are uploaded to Pinata (free tier: 1GB / 500 files),
 * and the CID (content identifier) is stored on-chain as evidence_hash
 * in the contract_registry program.
 */

const PINATA_API_URL = 'https://api.pinata.cloud'
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud'

/**
 * Upload a file to Pinata IPFS. Server-side only (uses PINATA_JWT).
 * Returns the IPFS CID (content identifier).
 */
export async function uploadToPinata(
  file: Buffer | Uint8Array,
  filename: string,
  metadata?: Record<string, string>,
): Promise<{ cid: string; url: string }> {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    throw new Error('PINATA_JWT environment variable is not set')
  }

  const formData = new FormData()
  const blob = new Blob([new Uint8Array(file)], { type: 'application/octet-stream' })
  formData.append('file', blob, filename)

  if (metadata) {
    formData.append('pinataMetadata', JSON.stringify({
      name: filename,
      keyvalues: metadata,
    }))
  }

  const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Pinata upload failed (${response.status}): ${text}`)
  }

  const data = await response.json()
  const cid = data.IpfsHash as string

  return {
    cid,
    url: getIpfsUrl(cid),
  }
}

/** Build the public IPFS gateway URL for a given CID */
export function getIpfsUrl(cid: string): string {
  return `${PINATA_GATEWAY}/ipfs/${cid}`
}

/** Check if a CID exists on Pinata */
export async function pinataFileExists(cid: string): Promise<boolean> {
  const jwt = process.env.PINATA_JWT
  if (!jwt) return false

  try {
    const response = await fetch(
      `${PINATA_API_URL}/data/pinList?hashContains=${cid}&status=pinned`,
      {
        headers: { Authorization: `Bearer ${jwt}` },
      },
    )
    if (!response.ok) return false
    const data = await response.json()
    return data.count > 0
  } catch {
    return false
  }
}
