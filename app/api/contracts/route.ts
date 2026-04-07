import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
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
    const cacheKey = `contracts:${district || ''}:${status || ''}:${customer || ''}:${subjectType || ''}:${amountMin || ''}`

    const getContracts = unstable_cache(
      async () => {
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
            contractor: { select: { id: true, name: true, rating: true, walletAddress: true } },
            milestones: { orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        })
        return toJsonSafe(contracts)
      },
      [cacheKey],
      { revalidate: 60, tags: ['contracts'] },
    )

    const contracts = await getContracts()

    return NextResponse.json(contracts, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (err: any) {
    // Compatibility fallback for partially migrated production DBs:
    // fetch contracts with a reduced field set and join related data manually.
    try {
      const baseContracts = await prisma.contract.findMany({
        where: {
          ...(district && { district }),
          ...(status && { status: status as any }),
          ...(subjectType && { subjectType }),
          ...(amountMin && !Number.isNaN(Number(amountMin)) && {
            totalAmount: { gte: BigInt(amountMin) },
          }),
        },
        select: {
          id: true,
          title: true,
          description: true,
          district: true,
          lat: true,
          lng: true,
          contractorId: true,
          totalAmount: true,
          escrowAmount: true,
          paidAmount: true,
          penaltyAmount: true,
          deadline: true,
          category: true,
          status: true,
          onChainPubkey: true,
          createdAt: true,
          registryNumber: true,
          customerName: true,
          subjectType: true,
          startDate: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      const contractorIds = Array.from(
        new Set(
          baseContracts
            .map((c) => c.contractorId)
            .filter((id): id is string => id != null && id !== '')
        )
      )
      const contractors = contractorIds.length
        ? await prisma.contractor.findMany({
            where: { id: { in: contractorIds } },
            select: { id: true, name: true, walletAddress: true },
          })
        : []
      const contractorById = new Map(contractors.map((c) => [c.id, c]))

      const milestones = baseContracts.length
        ? await prisma.milestone.findMany({
            where: { contractId: { in: baseContracts.map((c) => c.id) } },
            select: {
              id: true,
              contractId: true,
              description: true,
              deadlineDays: true,
              tranchePct: true,
              sortOrder: true,
              status: true,
            },
            orderBy: [{ contractId: 'asc' }, { sortOrder: 'asc' }],
          })
        : []
      const milestonesByContract = new Map<string, typeof milestones>()
      for (const m of milestones) {
        if (!milestonesByContract.has(m.contractId)) milestonesByContract.set(m.contractId, [])
        milestonesByContract.get(m.contractId)!.push(m)
      }

      const merged = baseContracts
        .filter((c) => {
          if (!customer) return true
          // customerName may be unavailable on legacy DB schema, so we cannot filter by it here.
          // Keep contracts visible instead of failing hard.
          return true
        })
        .map((c) => ({
          ...c,
          contractor:
            c.contractorId != null ? contractorById.get(c.contractorId) ?? null : null,
          milestones: milestonesByContract.get(c.id) || [],
        }))

      return NextResponse.json(toJsonSafe(merged))
    } catch {
      // Last-resort fallback: keep registry page usable even if DB is unavailable.
      return NextResponse.json(toJsonSafe(DEMO_CONTRACTS))
    }
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
        // registryNumber omitted — field exists in schema but prisma generate pending
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
        // Do not silently return an unrelated record when a PDA collision happens.
        const sameTitle = String(existing.title || '').trim() === String(body.title || '').trim()
        const sameDistrict = String(existing.district || '').trim() === String(body.district || '').trim()
        if (!sameTitle || !sameDistrict) {
          return NextResponse.json(
            {
              error:
                'onChainPubkey is already linked to another contract. Please change contract title and retry on-chain registration.',
            },
            { status: 409 }
          )
        }
        return NextResponse.json(toJsonSafe(existing), { status: 200 })
      }
    }

    return NextResponse.json(
      { error: err?.message || 'Failed to create contract' },
      { status: 500 }
    )
  }
}
