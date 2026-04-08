'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function toTimeInputValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function defaultDeadlineParts(daysFromNow: number): { date: string; time: string } {
  const d = new Date(Date.now() + daysFromNow * 86_400_000)
  return { date: toDateInputValue(d), time: toTimeInputValue(d) }
}

export function combineLocalDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null
  const [y, m, day] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  if ([y, m, day, hh, mm].some((x) => Number.isNaN(x))) return null
  const dt = new Date(y, m - 1, day, hh, mm, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

type Props = {
  date: string
  time: string
  onDateChange: (v: string) => void
  onTimeChange: (v: string) => void
  minDateStr: string
}

export function CampaignDeadlinePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  minDateStr,
}: Props) {
  const t = useTranslations('components.campaignDeadlinePicker')
  const locale = useLocale()
  const WEEKDAYS = useMemo(() => {
    // 2024-01-01 was a Monday; iterate Mon–Sun
    return Array.from({ length: 7 }, (_, i) =>
      new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2)
    )
  }, [locale])
  const [viewYear, setViewYear] = useState(() => {
    const d = date ? new Date(`${date}T12:00:00`) : new Date()
    return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const d = date ? new Date(`${date}T12:00:00`) : new Date()
    return Number.isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth()
  })

  useEffect(() => {
    if (!date) return
    const d = new Date(`${date}T12:00:00`)
    if (!Number.isNaN(d.getTime())) {
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [date])

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const startPad = (first.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const items: ({ kind: 'pad' } | { kind: 'day'; day: number })[] = []
    for (let i = 0; i < startPad; i++) items.push({ kind: 'pad' })
    for (let d = 1; d <= daysInMonth; d++) items.push({ kind: 'day', day: d })
    return items
  }, [viewYear, viewMonth])

  const monthTitle = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const goNext = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const dayStr = (day: number) =>
    `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={goPrev}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={t('prevMonth')}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">{monthTitle}</div>
          <button
            type="button"
            onClick={goNext}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={t('nextMonth')}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-500 dark:text-gray-400 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 font-medium">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (cell.kind === 'pad') {
              return <div key={`p-${i}`} className="aspect-square" />
            }
            const ds = dayStr(cell.day)
            const disabled = ds < minDateStr
            const selected = ds === date
            return (
              <button
                key={ds}
                type="button"
                disabled={disabled}
                onClick={() => onDateChange(ds)}
                className={`aspect-square rounded-lg text-sm font-medium transition-colors
                  ${selected
                    ? 'bg-emerald-600 text-white'
                    : disabled
                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      : 'text-gray-900 dark:text-white hover:bg-emerald-500/15 dark:hover:bg-emerald-500/20'
                  }`}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label htmlFor="cf-deadline-time" className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
          {t('collectionEndTime')}
        </label>
        <input
          id="cf-deadline-time"
          type="time"
          step={60}
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-full max-w-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm [color-scheme:light] dark:[color-scheme:dark]"
        />
      </div>

      <div>
        <label htmlFor="cf-deadline-native" className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
          {t('systemCalendarDate')}
        </label>
        <input
          id="cf-deadline-native"
          type="date"
          min={minDateStr}
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full max-w-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm [color-scheme:light] dark:[color-scheme:dark]"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {t('nativeDateHint')}
        </p>
      </div>
    </div>
  )
}
