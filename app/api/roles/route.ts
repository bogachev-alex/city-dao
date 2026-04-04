import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 })
  }

  const roles: UserRole[] = []
  const names: Record<string, string> = {}

  const citizen = await prisma.citizen.findUnique({ where: { walletAddress: wallet } })
  if (citizen) {
    roles.push('CITIZEN')
  }

  const contractor = await prisma.contractor.findFirst({ where: { walletAddress: wallet } })
  if (contractor) {
    roles.push('CONTRACTOR')
    names['CONTRACTOR'] = contractor.name
  }

  return NextResponse.json({ roles, names })
}
