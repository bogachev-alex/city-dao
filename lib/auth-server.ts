import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from './auth'

const VALID_ROLES: UserRole[] = ['CITIZEN', 'CONTRACTOR', 'AKIMAT']

/**
 * Extracts the user role from the incoming request.
 * Checks (in order):
 *  1. X-User-Role header (explicit role header)
 *  2. Authorization: Bearer <base64({role, id})> token
 */
export function getRoleFromRequest(req: NextRequest): UserRole | null {
  // 1. explicit header (simplest for tests / internal calls)
  const roleHeader = req.headers.get('x-user-role')
  if (roleHeader && VALID_ROLES.includes(roleHeader as UserRole)) {
    return roleHeader as UserRole
  }

  // 2. Bearer token
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = JSON.parse(
        Buffer.from(auth.slice(7), 'base64').toString('utf8')
      ) as { role?: string }
      if (payload.role && VALID_ROLES.includes(payload.role as UserRole)) {
        return payload.role as UserRole
      }
    } catch {
      // malformed token — fall through
    }
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
