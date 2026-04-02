import { NextRequest, NextResponse } from 'next/server'
import { fetchDistrictBudgets, fetchDistrictBudget } from '@/lib/opendata'

export const dynamic = 'force-dynamic'

// GET /api/opendata/budget?district=Медеуский — budget data from data.egov.kz
export async function GET(req: NextRequest) {
  const district = req.nextUrl.searchParams.get('district')

  try {
    if (district) {
      const budget = await fetchDistrictBudget(decodeURIComponent(district))
      if (!budget) {
        return NextResponse.json({ error: 'District not found' }, { status: 404 })
      }
      return NextResponse.json(budget)
    }

    const budgets = await fetchDistrictBudgets()
    return NextResponse.json({
      source: 'data.egov.kz',
      count: budgets.length,
      budgets,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('EGOV_OPENDATA_KEY')) {
      return NextResponse.json({
        source: 'data.egov.kz',
        count: 0,
        budgets: [],
        hint: 'Set EGOV_OPENDATA_KEY env variable to fetch live data',
      })
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
