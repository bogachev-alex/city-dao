import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const name = (body.name || '').trim()
  const walletAddress = (body.walletAddress || '').trim()
  const biin = (body.biin || '').trim()

  if (!name) {
    return NextResponse.json({ error: 'Название компании обязательно' }, { status: 400 })
  }

  if (!walletAddress) {
    return NextResponse.json({ error: 'Адрес кошелка обязателен' }, { status: 400 })
  }

  const existing = await prisma.contractor.findFirst({
    where: {
      OR: [
        { walletAddress },
        ...(biin ? [{ name }] : []),
      ],
    },
  })

  if (existing) {
    return NextResponse.json({
      error: 'Подрядчик с таким кошельком или названием уже зарегистрирован',
      contractor: existing,
    }, { status: 409 })
  }

  const contractor = await prisma.contractor.create({
    data: {
      name,
      walletAddress,
      rating: 'A',
      reputationScore: 50,
      onTimeRate: 0.5,
      acceptanceRate: 0.5,
      updateFrequency: 0.5,
      gpsAccuracy: 0.5,
      blockerSpeed: 0.5,
    },
  })

  return NextResponse.json(contractor, { status: 201 })
}
