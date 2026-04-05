import { NextRequest, NextResponse } from 'next/server'
import { getAdlBalance, isAdlConfigured } from '@/lib/adl-token'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAdlConfigured()) {
    return NextResponse.json({ balance: 0, configured: false })
  }

  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet param required' }, { status: 400 })
  }

  try {
    const balance = await getAdlBalance(wallet)
    return NextResponse.json({ balance, configured: true })
  } catch (e) {
    console.error('[ADL balance]', e)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
