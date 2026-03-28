import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/work-logs?contractId=... — get work logs for a contract
export async function GET(req: NextRequest) {
  const contractId = req.nextUrl.searchParams.get('contractId')

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

// POST /api/work-logs — submit work log entry
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Validate GPS proximity (within 500m of contract location)
  let gpsValid = false
  if (body.gpsLat && body.gpsLng) {
    const contract = await prisma.contract.findUnique({
      where: { id: body.contractId },
      select: { lat: true, lng: true },
    })
    if (contract) {
      const dist = haversineDistance(
        contract.lat, contract.lng,
        body.gpsLat, body.gpsLng
      )
      gpsValid = dist <= 500
    }
  }

  const log = await prisma.workLog.create({
    data: {
      contractId: body.contractId,
      contractorId: body.contractorId,
      type: body.type,
      title: body.title,
      description: body.description,
      completionPct: body.completionPct,
      workersOnSite: body.workersOnSite,
      equipmentCount: body.equipmentCount,
      photoHashes: body.photoHashes,
      gpsLat: body.gpsLat,
      gpsLng: body.gpsLng,
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
