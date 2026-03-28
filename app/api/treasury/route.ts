import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/treasury — list all district treasuries
export async function GET() {
  const treasuries = await prisma.districtTreasury.findMany({
    include: {
      proposals: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
    orderBy: { district: 'asc' },
  })

  return NextResponse.json(treasuries)
}
