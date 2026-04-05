import { NextRequest, NextResponse } from 'next/server'
import { getAuthPayload, requireRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PINATA_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'

/**
 * POST /api/ipfs/pin — multipart field "file" (single) or repeated "files"
 * Pins to IPFS via Pinata (PINATA_JWT). Returns { cids: string[] }.
 */
export async function POST(req: NextRequest) {
  const denied = requireRole(req, ['CONTRACTOR', 'AKIMAT'])
  if (denied) return denied

  const auth = getAuthPayload(req)
  if (!auth?.id) {
    return NextResponse.json({ error: 'Unauthorized: missing user id' }, { status: 401 })
  }

  const jwt = process.env.PINATA_JWT
  if (!jwt?.trim()) {
    return NextResponse.json(
      { error: 'IPFS pinning not configured (PINATA_JWT)' },
      { status: 503 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const single = formData.get('file')
  const many = formData.getAll('files')
  const entries: File[] = []
  if (single instanceof File && single.size > 0) entries.push(single)
  for (const f of many) {
    if (f instanceof File && f.size > 0) entries.push(f)
  }

  if (!entries.length) {
    return NextResponse.json({ error: 'No files (use file or files field)' }, { status: 400 })
  }

  const cids: string[] = []

  for (const file of entries) {
    const buf = Buffer.from(await file.arrayBuffer())
    const body = new FormData()
    body.append('file', new Blob([buf]), file.name)

    const res = await fetch(PINATA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: body as unknown as BodyInit,
    })

    const json = (await res.json().catch(() => ({}))) as { IpfsHash?: string; error?: { details?: string } }

    if (!res.ok) {
      const msg = json.error?.details || res.statusText || 'Pinata error'
      return NextResponse.json({ error: msg, cids }, { status: 502 })
    }

    if (!json.IpfsHash) {
      return NextResponse.json({ error: 'Pinata response missing IpfsHash' }, { status: 502 })
    }

    cids.push(json.IpfsHash)
  }

  return NextResponse.json({ cids })
}
