import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cronAuth'
import { runExpiredCrowdfundingRefunds } from '@/lib/crowdfundingAutoRefund'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Vercel Cron and manual triggers: send Authorization: Bearer CRON_SECRET */
export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runExpiredCrowdfundingRefunds()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runExpiredCrowdfundingRefunds()
  return NextResponse.json(result)
}
