'use client'

import { getCryptoEquivalent } from '@/lib/contracts'

interface CryptoTooltipProps {
  amount: number
  children: React.ReactNode
  className?: string
}

/** Wraps children with a hover tooltip showing SOL/USDT equivalent */
export default function CryptoTooltip({ amount, children, className }: CryptoTooltipProps) {
  return (
    <span className={`relative group/crypto inline-flex items-center gap-1 ${className ?? ''}`}>
      {children}
      <span className="hidden group-hover/crypto:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-gray-900 dark:bg-gray-700 text-[10px] text-gray-200 whitespace-nowrap z-50 shadow-lg pointer-events-none">
        {getCryptoEquivalent(amount)}
      </span>
    </span>
  )
}
