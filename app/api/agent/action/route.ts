import { NextRequest, NextResponse } from 'next/server'
import { dispatchAgentAction } from '@/lib/agent/dispatch-action'
import type { AgentRole } from '@/lib/agent/observe'

export const dynamic = 'force-dynamic'

const ROLES: AgentRole[] = ['CITIZEN', 'CONTRACTOR', 'AKIMAT']

export async function POST(req: NextRequest) {
  let body: {
    role?: string
    agentId?: string
    action?: string
    params?: Record<string, unknown>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { role, agentId, action, params = {} } = body
  if (!role || !ROLES.includes(role as AgentRole)) {
    return NextResponse.json({ error: 'role must be CITIZEN, CONTRACTOR, or AKIMAT' }, { status: 400 })
  }
  if (!agentId || typeof agentId !== 'string') {
    return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
  }
  if (!action || typeof action !== 'string') {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  try {
    const result = await dispatchAgentAction(role as AgentRole, agentId, action, params)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Action failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
