import { NextRequest, NextResponse } from 'next/server'
import { uploadToPinata, getIpfsUrl } from '@/lib/pinata'

/**
 * POST /api/evidence — Upload milestone evidence to Pinata IPFS.
 *
 * Expects multipart/form-data with:
 *   - file: the evidence photo/document
 *   - contractId: (optional) associated contract PDA
 *   - milestoneIndex: (optional) milestone index
 *
 * Returns: { cid, url }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF' },
        { status: 400 },
      )
    }

    const contractId = formData.get('contractId') as string | null
    const milestoneIndex = formData.get('milestoneIndex') as string | null

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `evidence_${contractId || 'unknown'}_m${milestoneIndex || '0'}_${Date.now()}.${file.name.split('.').pop()}`

    const metadata: Record<string, string> = {}
    if (contractId) metadata.contractId = contractId
    if (milestoneIndex) metadata.milestoneIndex = milestoneIndex

    const result = await uploadToPinata(buffer, filename, metadata)

    return NextResponse.json({
      cid: result.cid,
      url: result.url,
    })
  } catch (err: any) {
    console.error('Evidence upload error:', err)

    if (err?.message?.includes('PINATA_JWT')) {
      return NextResponse.json(
        { error: 'IPFS service not configured' },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: err?.message || 'Upload failed' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/evidence?cid=Qm... — Get IPFS gateway URL for a CID.
 */
export async function GET(request: NextRequest) {
  const cid = request.nextUrl.searchParams.get('cid')
  if (!cid) {
    return NextResponse.json({ error: 'Missing cid parameter' }, { status: 400 })
  }

  return NextResponse.json({ url: getIpfsUrl(cid) })
}
