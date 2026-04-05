'use client'

import { getCryptoEquivalent } from '@/lib/contracts'

interface CryptoTooltipProps {
  amount: number
  children: React.ReactNode
  className?: string
}

/** Wraps children with a crypto-conversion icon; hover shows SOL/USDT tooltip */
export default function CryptoTooltip({ amount, children, className }: CryptoTooltipProps) {
  if (!amount || amount <= 0) return <span className={className}>{children}</span>

  return (
    <span className={`relative group/crypto inline-flex items-center gap-1 ${className ?? ''}`}>
      {children}
      {/* exchange icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0 text-gray-400 dark:text-gray-500 group-hover/crypto:text-emerald-500 dark:group-hover/crypto:text-emerald-400 transition-colors cursor-help"
      >
        <path d="M7 10l5-6 5 6" />
        <path d="M7 14l5 6 5-6" />
      </svg>
      {/* tooltip */}
      <span className="hidden group-hover/crypto:flex flex-col items-start absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-700 whitespace-nowrap z-50 shadow-lg pointer-events-none border border-gray-700 dark:border-gray-600">
        <span className="text-[10px] text-gray-400 dark:text-gray-400 mb-0.5">Crypto equivalent</span>
        <span className="text-[11px] text-gray-100 font-medium">{getCryptoEquivalent(amount)}</span>
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
      </span>
    </span>
  )
}
