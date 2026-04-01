import { NextRequest, NextResponse } from 'next/server'
import { buildObserve, type AgentRole } from '@/lib/agent/observe'

export const dynamic = 'force-dynamic'

const ROLES: AgentRole[] = ['CITIZEN', 'CONTRACTOR', 'AKIMAT']

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get('role') as AgentRole | null
  const id = req.nextUrl.searchParams.get('id')

  if (!role || !ROLES.includes(role)) {
    return NextResponse.json(
      { error: 'Query params role (CITIZEN|CONTRACTOR|AKIMAT) and id are required' },
      { status: 400 }
    )
  }
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const payload = await buildObserve(role, id)
  if ('error' in payload) {
    return NextResponse.json({ error: payload.error }, { status: 404 })
  }
  return NextResponse.json(payload)
}
