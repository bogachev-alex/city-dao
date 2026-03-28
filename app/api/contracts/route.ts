import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/contracts — list contracts with optional filters
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const district = searchParams.get('district')
  const status = searchParams.get('status')

  const contracts = await prisma.contract.findMany({
    where: {
      ...(district && { district }),
      ...(status && { status: status as any }),
    },
    include: {
      contractor: { select: { id: true, name: true, rating: true } },
      milestones: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(contracts)
}

// POST /api/contracts — register a new contract (akimat only)
export async function POST(req: NextRequest) {
  const body = await req.json()

  const contract = await prisma.contract.create({
    data: {
      title: body.title,
      description: body.description,
      district: body.district,
      lat: body.lat,
      lng: body.lng,
      contractorId: body.contractorId,
      totalAmount: BigInt(body.totalAmount),
      escrowAmount: BigInt(Math.floor(body.totalAmount * 0.2)),
      deadline: new Date(body.deadline),
      category: body.category,
      milestones: {
        create: body.milestones.map((m: any, i: number) => ({
          description: m.description,
          deadlineDays: m.deadlineDays,
          tranchePct: m.tranchePct,
          sortOrder: i + 1,
        })),
      },
    },
    include: {
      contractor: { select: { id: true, name: true } },
      milestones: { orderBy: { sortOrder: 'asc' } },
    },
  })

  return NextResponse.json(contract, { status: 201 })
}
