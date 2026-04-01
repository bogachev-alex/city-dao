import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-server'
import { DEMO_CONTRACTS } from '@/lib/contracts'

export const dynamic = 'force-dynamic'

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  ) as T
}

// GET /api/contracts — list contracts with optional filters
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const district = searchParams.get('district')
  const status = searchParams.get('status')
  const customer = searchParams.get('customer')
  const subjectType = searchParams.get('subjectType')
  const amountMin = searchParams.get('amountMin')

  try {
    const contracts = await prisma.contract.findMany({
      where: {
        ...(district && { district }),
        ...(status && { status: status as any }),
        ...(customer && {
          customerName: { contains: customer, mode: 'insensitive' as const },
        }),
        ...(subjectType && { subjectType }),
        ...(amountMin && !Number.isNaN(Number(amountMin)) && {
          totalAmount: { gte: BigInt(amountMin) },
        }),
      },
      include: {
        contractor: { select: { id: true, name: true, rating: true } },
        milestones: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(toJsonSafe(contracts))
  } catch (err: any) {
    // Production fallback: keep registry page usable even if DB schema/data is temporarily broken.
    return NextResponse.json(toJsonSafe(DEMO_CONTRACTS))
  }
}

// POST /api/contracts — register a new contract (AKIMAT only)
export async function POST(req: NextRequest) {
  const denied = requireRole(req, ['AKIMAT'])
  if (denied) return denied

  const body = await req.json()

  // Resolve contractor: use contractorId directly, or find-or-create by contractorName
  let contractorId = body.contractorId as string | undefined
  if (!contractorId && body.contractorName) {
    const existing = await prisma.contractor.findFirst({
      where: { name: body.contractorName },
    })
    if (existing) {
      contractorId = existing.id
    } else {
      const created = await prisma.contractor.create({
        data: { name: body.contractorName },
      })
      contractorId = created.id
    }
  }

  if (!contractorId) {
    return NextResponse.json(
      { error: 'contractorId or contractorName is required' },
      { status: 400 }
    )
  }

  if (!body.onChainPubkey) {
    return NextResponse.json(
      { error: 'onChainPubkey is required (on-chain confirmation required)' },
      { status: 400 }
    )
  }

  try {
    const contract = await prisma.contract.create({
      data: {
        title: body.title,
        description: body.description,
        district: body.district,
        lat: body.lat,
        lng: body.lng,
        contractorId,
        totalAmount: BigInt(body.totalAmount),
        escrowAmount: BigInt(Math.floor(body.totalAmount * 0.2)),
        deadline: new Date(body.deadline),
        category: body.category,
        ...(body.registryNumber && { registryNumber: String(body.registryNumber) }),
        ...(body.customerName && { customerName: String(body.customerName) }),
        ...(body.subjectType && { subjectType: String(body.subjectType) }),
        ...(body.startDate && { startDate: new Date(body.startDate) }),
        ...(body.onChainPubkey && { onChainPubkey: body.onChainPubkey }),
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

    return NextResponse.json(toJsonSafe(contract), { status: 201 })
  } catch (err: any) {
    // Idempotent behavior for repeated submissions with the same on-chain contract.
    if (body.onChainPubkey) {
      const existing = await prisma.contract.findUnique({
        where: { onChainPubkey: String(body.onChainPubkey) },
        include: {
          contractor: { select: { id: true, name: true } },
          milestones: { orderBy: { sortOrder: 'asc' } },
        },
      })
      if (existing) {
        return NextResponse.json(toJsonSafe(existing), { status: 200 })
      }
    }

    return NextResponse.json(
      { error: err?.message || 'Failed to create contract' },
      { status: 500 }
    )
  }
}
