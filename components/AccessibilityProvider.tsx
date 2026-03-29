'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const A11yContext = createContext<{ enabled: boolean; toggle: () => void }>({
  enabled: false,
  toggle: () => {},
})

export const useA11y = () => useContext(A11yContext)

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('a11y') === 'true'
    if (stored) {
      setEnabled(true)
      document.documentElement.classList.add('a11y')
    }
  }, [])

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    localStorage.setItem('a11y', String(next))
    document.documentElement.classList.toggle('a11y', next)
  }

  return (
    <A11yContext.Provider value={{ enabled, toggle }}>
      {children}
    </A11yContext.Provider>
  )
}
