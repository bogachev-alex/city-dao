import { NextRequest, NextResponse } from 'next/server'
import { runExpiredCrowdfundingRefunds } from '@/lib/crowdfundingAutoRefund'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  const header = req.headers.get('x-cron-secret')
  return header === secret
}

/** Vercel Cron and manual triggers: send Authorization: Bearer CRON_SECRET */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runExpiredCrowdfundingRefunds()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runExpiredCrowdfundingRefunds()
  return NextResponse.json(result)
}
