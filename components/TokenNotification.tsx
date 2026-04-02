'use client'

import { useEffect, useState } from 'react'
import type { TokenTransaction } from '@/lib/tokens'
import { formatBalance } from '@/lib/tokens'

interface Notification {
  id: string
  tx: TokenTransaction
}

export default function TokenNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    function handleAward(e: Event) {
      const tx = (e as CustomEvent<TokenTransaction>).detail
      const id = tx.id
      setNotifications((prev) => [...prev, { id, tx }])
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }, 4000)
    }

    window.addEventListener('amanat-token-award', handleAward)
    return () => window.removeEventListener('amanat-token-award', handleAward)
  }, [])

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
      {notifications.map(({ id, tx }) => (
        <div
          key={id}
          className="animate-slide-in-right bg-gray-900 border border-emerald-500/30 rounded-xl px-4 py-3 shadow-lg shadow-emerald-500/10 flex items-center gap-3 min-w-[280px]"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-400 font-bold text-sm">ADL</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-emerald-400 font-bold text-sm">
              +{formatBalance(tx.amount)} ADL
            </div>
            <div className="text-gray-400 text-xs truncate">{tx.description}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
