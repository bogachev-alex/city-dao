import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthPayload, requireRole } from '@/lib/auth-server'
import { ownsContract } from '@/lib/ownsContract'

export const dynamic = 'force-dynamic'

const WORK_LOG_TYPES = ['DAILY_LOG', 'MILESTONE_CLAIM', 'BLOCKER', 'MATERIAL_DELIVERY'] as const
type WorkLogTypeStr = (typeof WORK_LOG_TYPES)[number]

function isWorkLogType(v: unknown): v is WorkLogTypeStr {
  return typeof v === 'string' && (WORK_LOG_TYPES as readonly string[]).includes(v)
}

// GET /api/work-logs?contractId=... — work logs for a contract
// GET /api/work-logs?type=BLOCKER&district=... — AKIMAT: recent blockers in district (auth required)
export async function GET(req: NextRequest) {
  const contractId = req.nextUrl.searchParams.get('contractId')
  const typeFilter = req.nextUrl.searchParams.get('type')
  const district = req.nextUrl.searchParams.get('district')

  if (typeFilter === 'BLOCKER' && district) {
    const denied = requireRole(req, ['AKIMAT'])
    if (denied) return denied
    const logs = await prisma.workLog.findMany({
      where: {
        type: 'BLOCKER',
        contract: { district: decodeURIComponent(district) },
      },
      include: {
        contractor: { select: { id: true, name: true } },
        contract: { select: { id: true, title: true, district: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(logs)
  }

  if (!contractId) {
    return NextResponse.json({ error: 'contractId required' }, { status: 400 })
  }

  const logs = await prisma.workLog.findMany({
    where: { contractId },
    include: {
      contractor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(logs)
}

// POST /api/work-logs — submit work log entry (contractor must own contract)
export async function POST(req: NextRequest) {
  const denied = requireRole(req, ['CONTRACTOR'])
  if (denied) return denied

  const auth = getAuthPayload(req)
  if (!auth?.id) {
    return NextResponse.json({ error: 'Unauthorized: missing user id' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const contractId = typeof body.contractId === 'string' ? body.contractId : null
  if (!contractId) {
    return NextResponse.json({ error: 'contractId required' }, { status: 400 })
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      contractorId: true,
      lat: true,
      lng: true,
      contractor: { select: { name: true } },
    },
  })
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }
  if (!ownsContract(auth.id, contract.contractorId, contract.contractor?.name)) {
    return NextResponse.json({ error: 'Forbidden: not your contract' }, { status: 403 })
  }

  if (!isWorkLogType(body.type)) {
    return NextResponse.json({ error: 'Invalid work log type' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  let completionPct: number | null | undefined
  if (body.completionPct != null && body.completionPct !== '') {
    const n = Number(body.completionPct)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ error: 'completionPct must be 0-100' }, { status: 400 })
    }
    completionPct = Math.round(n)
  } else if (body.type !== 'BLOCKER') {
    completionPct = undefined
  } else {
    completionPct = null
  }

  let workersOnSite: number | null | undefined
  if (body.workersOnSite != null && body.workersOnSite !== '') {
    const w = Number(body.workersOnSite)
    if (!Number.isFinite(w) || w < 0) {
      return NextResponse.json({ error: 'workersOnSite invalid' }, { status: 400 })
    }
    workersOnSite = Math.round(w)
  }

  let equipmentCount: number | null | undefined
  if (body.equipmentCount != null && body.equipmentCount !== '') {
    const e = Number(body.equipmentCount)
    if (!Number.isFinite(e) || e < 0) {
      return NextResponse.json({ error: 'equipmentCount invalid' }, { status: 400 })
    }
    equipmentCount = Math.round(e)
  }

  let photoHashes: string[] | undefined
  if (Array.isArray(body.photoHashes)) {
    const hashes = body.photoHashes.filter((h): h is string => typeof h === 'string')
    photoHashes = hashes.length ? hashes : undefined
  }

  const desc =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : undefined

  let gpsLat: number | undefined
  let gpsLng: number | undefined
  if (body.gpsLat != null && body.gpsLng != null) {
    const la = Number(body.gpsLat)
    const ln = Number(body.gpsLng)
    if (Number.isFinite(la) && Number.isFinite(ln)) {
      gpsLat = la
      gpsLng = ln
    }
  }

  let gpsValid = false
  if (gpsLat != null && gpsLng != null) {
    const dist = haversineDistance(contract.lat, contract.lng, gpsLat, gpsLng)
    gpsValid = dist <= 500
  }

  const log = await prisma.workLog.create({
    data: {
      contractId,
      contractorId: contract.contractorId,
      type: body.type as WorkLogTypeStr,
      title,
      description: desc,
      completionPct: completionPct ?? null,
      workersOnSite: workersOnSite ?? null,
      equipmentCount: equipmentCount ?? null,
      photoHashes: photoHashes ?? undefined,
      gpsLat: gpsLat ?? null,
      gpsLng: gpsLng ?? null,
      gpsValid,
    },
  })

  return NextResponse.json(log, { status: 201 })
}

// Haversine formula — distance in meters between two GPS points
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
