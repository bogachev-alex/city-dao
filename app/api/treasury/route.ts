import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTreasuryPDA } from '@/lib/web3/pda'

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

  const enriched = treasuries.map((t) => {
    let pdaAddress: string | null = null
    try {
      const [pda] = getTreasuryPDA(t.district)
      pdaAddress = pda.toBase58()
    } catch {}

    return {
      ...t,
      balance: t.balance.toString(),
      pdaAddress,
    }
  })

  return NextResponse.json(enriched)
}
