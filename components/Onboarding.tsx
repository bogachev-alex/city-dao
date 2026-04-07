'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import AmaniMascot from './AmaniMascot'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'onboarding_completed'

interface Step {
  titleKey: string
  textKey: string
  mood: 'happy' | 'thinking' | 'waving' | 'surprised'
  icon: string
  target: string // data-tour attribute value
  position: 'bottom' | 'bottom-right' | 'bottom-left'
}

const STEPS: Step[] = [
  {
    titleKey: 'steps.hello.title',
    textKey: 'steps.hello.text',
    mood: 'waving',
    icon: '👋',
    target: 'logo',
    position: 'bottom',
  },
  {
    titleKey: 'steps.map.title',
    textKey: 'steps.map.text',
    mood: 'happy',
    icon: '🗺️',
    target: 'map',
    position: 'bottom',
  },
  {
    titleKey: 'steps.contracts.title',
    textKey: 'steps.contracts.text',
    mood: 'thinking',
    icon: '📋',
    target: 'contracts',
    position: 'bottom',
  },
  {
    titleKey: 'steps.crowdfunding.title',
    textKey: 'steps.crowdfunding.text',
    mood: 'surprised',
    icon: '💰',
    target: 'crowdfunding',
    position: 'bottom',
  },
  {
    titleKey: 'steps.treasury.title',
    textKey: 'steps.treasury.text',
    mood: 'thinking',
    icon: '🏛️',
    target: 'treasury',
    position: 'bottom',
  },
  {
    titleKey: 'steps.admin.title',
    textKey: 'steps.admin.text',
    mood: 'happy',
    icon: '🏗️',
    target: 'admin',
    position: 'bottom',
  },
  {
    titleKey: 'steps.register.title',
    textKey: 'steps.register.text',
    mood: 'waving',
    icon: '🛡️',
    target: 'auth',
    position: 'bottom-left',
  },
]

export default function Onboarding() {
  const t = useTranslations('onboarding')
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; arrowLeft: number; targetRect: DOMRect | null }>({
    top: 80,
    left: 100,
    arrowLeft: 50,
    targetRect: null,
  })
  const cardRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    const current = STEPS[step]
    if (!current) return
    const el = document.querySelector(`[data-tour="${current.target}"]`) as HTMLElement | null
    if (!el) return

    const rect = el.getBoundingClientRect()
    const cardW = 360
    const gap = 12

    let left: number
    let arrowLeft: number

    if (current.position === 'bottom-left') {
      // Align card's right edge with target's right edge
      left = Math.max(8, rect.right - cardW)
      arrowLeft = rect.left + rect.width / 2 - left
    } else if (current.position === 'bottom-right') {
      left = rect.left
      arrowLeft = rect.width / 2
    } else {
      // Center card under target
      left = rect.left + rect.width / 2 - cardW / 2
      arrowLeft = cardW / 2
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - cardW - 8))
    arrowLeft = Math.max(16, Math.min(arrowLeft, cardW - 16))

    setPos({
      top: rect.bottom + gap,
      left,
      arrowLeft,
      targetRect: rect,
    })

    // Elevate target
    el.style.position = 'relative'
    el.style.zIndex = '2001'
    el.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.4), 0 0 20px rgba(16,185,129,0.2)'
    el.style.borderRadius = '8px'
    el.style.transition = 'box-shadow 0.3s'
  }, [step])

  const clearHighlight = useCallback(() => {
    document.querySelectorAll('[data-tour]').forEach((el) => {
      const htmlEl = el as HTMLElement
      htmlEl.style.zIndex = ''
      htmlEl.style.boxShadow = ''
      htmlEl.style.position = ''
      htmlEl.style.borderRadius = ''
    })
  }, [])

  // Auto-launch only for logged-in users who haven't seen the tour
  useEffect(() => {
    try {
      if (user && !localStorage.getItem(STORAGE_KEY)) {
        setVisible(true)
      }
    } catch {}
  }, [user])

  // Listen for external trigger (e.g. from landing page "How it works" button)
  useEffect(() => {
    const handler = () => {
      setStep(0)
      setVisible(true)
    }
    window.addEventListener('start-onboarding', handler)
    return () => window.removeEventListener('start-onboarding', handler)
  }, [])

  useEffect(() => {
    if (!visible) {
      clearHighlight()
      return
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      clearHighlight()
    }
  }, [visible, step, updatePosition, clearHighlight])

  const handleClose = () => {
    clearHighlight()
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {}
  }

  const handleNext = () => {
    clearHighlight()
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (step > 0) {
      clearHighlight()
      setStep(step - 1)
    }
  }

  const handleDotClick = (i: number) => {
    clearHighlight()
    setStep(i)
  }

  const handleReset = () => {
    setStep(0)
    setVisible(true)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  // Floating mascot button when tour is closed
  if (!visible) {
    return (
      <button
        onClick={handleReset}
        className="fixed bottom-6 right-6 z-[2000] group"
        title={t('helpButton')}
      >
        <div className="w-14 h-14 rounded-full bg-white dark:bg-gray-900 border-2 border-emerald-400 dark:border-emerald-500/50 shadow-lg shadow-emerald-500/20 flex items-center justify-center hover:scale-110 transition-transform">
          <AmaniMascot size={38} mood="happy" />
        </div>
        <div className="absolute -top-8 right-0 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {t('helpButton')}
        </div>
      </button>
    )
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <>
      {/* Overlay — click to dismiss */}
      <div
        className="fixed inset-0 z-[2000] bg-black/40"
        onClick={handleClose}
      />

      {/* Tooltip card */}
      <div
        ref={cardRef}
        className="fixed z-[2002] w-[360px] animate-in fade-in"
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow pointing up to target */}
        <div
          className="absolute -top-2 w-4 h-4 bg-white dark:bg-gray-900 border-l border-t border-gray-200 dark:border-gray-700 rotate-45"
          style={{ left: pos.arrowLeft - 8 }}
        />

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <div className="shrink-0 relative">
              <AmaniMascot size={48} mood={current.mood} />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-gray-800 border border-emerald-400 flex items-center justify-center text-xs">
                {current.icon}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-gray-900 dark:text-white font-bold text-sm">{t(current.titleKey as any)}</h3>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{step + 1} / {STEPS.length}</div>
            </div>
            <button
              onClick={handleClose}
              className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
            >
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-4 pb-3">
            <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{t(current.textKey as any)}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 pb-3">
            {/* Dots */}
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleDotClick(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'w-4 bg-emerald-500'
                      : i < step
                      ? 'w-1.5 bg-emerald-300 dark:bg-emerald-600'
                      : 'w-1.5 bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-1">
              {step > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-2.5 py-1 rounded-md text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {t('back')}
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
              >
                {isLast ? t('done') : t('next')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
