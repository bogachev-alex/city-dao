'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = {
  /** IPFS CIDs (Pinata) */
  value: string[]
  onChange: (cids: string[]) => void
  authHeader: () => Record<string, string>
  disabled?: boolean
  maxFiles?: number
}

export default function PhotoEvidenceUpload({
  value,
  onChange,
  authHeader,
  disabled,
  maxFiles = 8,
}: Props) {
  const t = useTranslations('contractorPage.photoEvidence')
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || disabled) return
      const remaining = maxFiles - value.length
      if (remaining <= 0) {
        setError(t('maxFiles', { max: maxFiles }))
        return
      }
      const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, remaining)
      if (!list.length) {
        setError(t('imagesOnly'))
        return
      }

      setError(null)
      setUploading(true)
      try {
        const fd = new FormData()
        for (const f of list) {
          fd.append('files', f)
        }
        const res = await fetch('/api/ipfs/pin', {
          method: 'POST',
          headers: { ...authHeader() },
          body: fd,
        })
        const data = (await res.json().catch(() => ({}))) as { cids?: string[]; error?: string }
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : t('uploadFailed'))
          return
        }
        const next = [...value, ...(data.cids || [])]
        onChange(next)
      } catch {
        setError(t('uploadFailed'))
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [authHeader, disabled, maxFiles, onChange, t, value]
  )

  const remove = (idx: number) => {
    const next = value.filter((_, i) => i !== idx)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{t('label')}</label>
      <div
        className={`rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center ${
          disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-emerald-500/50'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void addFiles(e.dataTransfer.files)
        }}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => void addFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{t('uploading')}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('hint')}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {t('count', { current: value.length, max: maxFiles })}
        </p>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((cid, i) => (
            <li
              key={`${cid}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-mono text-gray-700 dark:text-gray-200"
            >
              <span className="truncate max-w-[140px]" title={cid}>
                {cid.slice(0, 8)}…
              </span>
              <button
                type="button"
                className="text-red-500 hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(i)
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
