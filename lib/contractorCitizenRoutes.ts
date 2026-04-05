'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/routing'
import { useAuth } from '@/components/AuthContext'

/**
 * Crowdfunding and district treasury voting are citizen flows; contractors are redirected to their desk.
 */
export function useRedirectContractorFromCitizenEconomyPages(redirectPath = '/contractor') {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user?.role === 'CONTRACTOR') {
      router.replace(redirectPath as any)
    }
  }, [loading, user, router, redirectPath])

  /** Hide page while auth loads or contractor is being redirected away */
  const holdUi = loading || user?.role === 'CONTRACTOR'
  return { holdUi }
}
