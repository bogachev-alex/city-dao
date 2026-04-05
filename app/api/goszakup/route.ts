import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { fetchGoszakupContracts, normalizeGoszakupContracts } from '@/lib/goszakup'

export const dynamic = 'force-dynamic'

// GET /api/goszakup — proxy to goszakup.gov.kz, returns normalized contracts
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)

  try {
    const getCachedGoszakup = unstable_cache(
      async () => {
        const raw = await fetchGoszakupContracts(limit)
        return normalizeGoszakupContracts(raw)
      },
      [`goszakup:${limit}`],
      { revalidate: 3600 }, // 1 hour — external API, rarely changes
    )

    const contracts = await getCachedGoszakup()
    return NextResponse.json({
      source: 'goszakup.gov.kz',
      count: contracts.length,
      contracts,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // If token is not configured, return empty with a hint
    if (message.includes('GOSZAKUP_TOKEN')) {
      return NextResponse.json({
        source: 'goszakup.gov.kz',
        count: 0,
        contracts: [],
        hint: 'Set GOSZAKUP_TOKEN env variable to fetch live data',
      })
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
