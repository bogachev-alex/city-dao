import { NextRequest } from 'next/server'

/** Authorize Vercel Cron / manual calls using CRON_SECRET (Bearer or x-cron-secret). */
export function authorizeCronRequest(req: NextRequest, envName: string = 'CRON_SECRET'): boolean {
  const secret = process.env[envName]
  if (!secret) return false
  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  const header = req.headers.get('x-cron-secret')
  return header === secret
}
