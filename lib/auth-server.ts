import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from './auth'

const VALID_ROLES: UserRole[] = ['CITIZEN', 'CONTRACTOR', 'AKIMAT']

export type AuthPayload = { role: UserRole; id: string | null }

/**
 * Parses Authorization Bearer token (same shape as encodeAuthToken in lib/auth.ts).
 */
function parseBearerPayload(req: NextRequest): { role?: string; id?: string } | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    return JSON.parse(Buffer.from(auth.slice(7), 'base64').toString('utf8')) as {
      role?: string
      id?: string
    }
  } catch {
    return null
  }
}

/**
 * Extracts the user role from the incoming request.
 * Checks (in order):
 *  1. X-User-Role header (explicit role header)
 *  2. Authorization: Bearer <base64({role, id})> token
 */
export function getRoleFromRequest(req: NextRequest): UserRole | null {
  const roleHeader = req.headers.get('x-user-role')
  if (roleHeader && VALID_ROLES.includes(roleHeader as UserRole)) {
    return roleHeader as UserRole
  }

  const payload = parseBearerPayload(req)
  if (payload?.role && VALID_ROLES.includes(payload.role as UserRole)) {
    return payload.role as UserRole
  }

  return null
}

/**
 * Full auth payload including user id (contractor / citizen DB id or demo id).
 * Prefer Bearer token so id is always available for ownership checks.
 */
export function getAuthPayload(req: NextRequest): AuthPayload | null {
  const bearer = parseBearerPayload(req)
  if (bearer?.role && VALID_ROLES.includes(bearer.role as UserRole)) {
    return {
      role: bearer.role as UserRole,
      id: typeof bearer.id === 'string' ? bearer.id : null,
    }
  }

  const roleHeader = req.headers.get('x-user-role')
  if (roleHeader && VALID_ROLES.includes(roleHeader as UserRole)) {
    return { role: roleHeader as UserRole, id: null }
  }

  return null
}

/**
 * Returns a 403 response if the caller's role is not in `allowed`.
 * Returns null when access is permitted.
 */
export function requireRole(
  req: NextRequest,
  allowed: UserRole[]
): NextResponse | null {
  const role = getRoleFromRequest(req)
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!allowed.includes(role)) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient role' },
      { status: 403 }
    )
  }
  return null
}
