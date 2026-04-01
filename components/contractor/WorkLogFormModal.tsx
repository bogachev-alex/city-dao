'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import PhotoEvidenceUpload from '@/components/contractor/PhotoEvidenceUpload'

const LOG_TYPES = ['DAILY_LOG', 'BLOCKER', 'MATERIAL_DELIVERY', 'MILESTONE_CLAIM'] as const
export type WorkLogTypeValue = (typeof LOG_TYPES)[number]

type ContractOption = { id: string; title: string }

type Props = {
  open: boolean
  onClose: () => void
  contracts: ContractOption[]
  authHeader: () => Record<string, string>
  onSuccess: () => void
}

function requestPosition(timeoutMs = 15000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    const id = window.setTimeout(() => reject(new Error('Geolocation timeout')), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(id)
        resolve(pos)
      },
      (err) => {
        window.clearTimeout(id)
        reject(err)
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: timeoutMs }
    )
  })
}

export default function WorkLogFormModal({
  open,
  onClose,
  contracts,
  authHeader,
  onSuccess,
}: Props) {
  const t = useTranslations('contractorPage.workLogForm')
  const [contractId, setContractId] = useState('')
  const [type, setType] = useState<WorkLogTypeValue>('DAILY_LOG')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [completionPct, setCompletionPct] = useState('')
  const [workersOnSite, setWorkersOnSite] = useState('')
  const [equipmentCount, setEquipmentCount] = useState('')
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [photoHashes, setPhotoHashes] = useState<string[]>([])

  const reset = useCallback(() => {
    setContractId(contracts[0]?.id ?? '')
    setType('DAILY_LOG')
    setTitle('')
    setDescription('')
    setCompletionPct('')
    setWorkersOnSite('')
    setEquipmentCount('')
    setGpsLat(null)
    setGpsLng(null)
    setGpsError(null)
    setFormError(null)
    setPhotoHashes([])
  }, [contracts])

  useEffect(() => {
    if (open && contracts.length && !contractId) {
      setContractId(contracts[0].id)
    }
  }, [open, contracts, contractId])

  if (!open) return null

  const runGps = async () => {
    setGpsError(null)
    try {
      const pos = await requestPosition()
      setGpsLat(pos.coords.latitude)
      setGpsLng(pos.coords.longitude)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown'
      setGpsLat(null)
      setGpsLng(null)
      setGpsError(msg)
    }
  }

  const submit = async (skipGps: boolean) => {
    const cid = contractId || contracts[0]?.id
    if (!cid) {
      setFormError(t('errorNoContract'))
      return
    }
    if (!title.trim()) {
      setFormError(t('errorTitle'))
      return
    }

    setFormError(null)
    setSubmitting(true)

    let lat: number | undefined
    let lng: number | undefined
    if (!skipGps) {
      if (gpsLat != null && gpsLng != null) {
        lat = gpsLat
        lng = gpsLng
      } else {
        try {
          const pos = await requestPosition()
          lat = pos.coords.latitude
          lng = pos.coords.longitude
          setGpsLat(lat)
          setGpsLng(lng)
        } catch (e: unknown) {
          setSubmitting(false)
          const msg = e instanceof Error ? e.message : String(e)
          setGpsError(msg)
          return
        }
      }
    }

    const body: Record<string, unknown> = {
      contractId: cid,
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      workersOnSite: workersOnSite === '' ? undefined : Number(workersOnSite),
      equipmentCount: equipmentCount === '' ? undefined : Number(equipmentCount),
    }

    if (type !== 'BLOCKER' && completionPct !== '') {
      body.completionPct = Number(completionPct)
    } else if (type !== 'BLOCKER') {
      body.completionPct = undefined
    } else if (completionPct !== '') {
      body.completionPct = Number(completionPct)
    }

    if (lat != null && lng != null) {
      body.gpsLat = lat
      body.gpsLng = lng
    }
    if (photoHashes.length) {
      body.photoHashes = photoHashes
    }

    try {
      const res = await fetch('/api/work-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(typeof data.error === 'string' ? data.error : t('errorSubmit'))
        setSubmitting(false)
        return
      }
      reset()
      onSuccess()
      onClose()
    } catch {
      setFormError(t('errorSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-log-modal-title"
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 id="work-log-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('title')}
          </h2>
          <button
            type="button"
            onClick={() => {
              reset()
              onClose()
            }}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
          >
            {t('close')}
          </button>
        </div>

        <div className="p-6 space-y-4">
          {contracts.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noContracts')}</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('contract')}</label>
                <select
                  value={contractId || contracts[0]?.id}
                  onChange={(e) => setContractId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('type')}</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as WorkLogTypeValue)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {LOG_TYPES.map((lt) => (
                    <option key={lt} value={lt}>
                      {t(`types.${lt}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('entryTitle')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  placeholder={t('entryTitlePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  placeholder={t('descriptionPlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t('completion')} {type === 'BLOCKER' ? `(${t('optional')})` : ''}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={completionPct}
                    onChange={(e) => setCompletionPct(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    placeholder="0–100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('workers')}</label>
                  <input
                    type="number"
                    min={0}
                    value={workersOnSite}
                    onChange={(e) => setWorkersOnSite(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('equipment')}</label>
                <input
                  type="number"
                  min={0}
                  value={equipmentCount}
                  onChange={(e) => setEquipmentCount(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <PhotoEvidenceUpload
                value={photoHashes}
                onChange={setPhotoHashes}
                authHeader={authHeader}
                disabled={submitting}
              />

              <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-300">{t('gpsHint')}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runGps()}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200"
                  >
                    {t('gpsRefresh')}
                  </button>
                  {gpsLat != null && gpsLng != null && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 self-center">
                      {t('gpsOk', { lat: gpsLat.toFixed(5), lng: gpsLng.toFixed(5) })}
                    </span>
                  )}
                </div>
                {gpsError && <p className="text-xs text-amber-600 dark:text-amber-400">{t('gpsError', { message: gpsError })}</p>}
              </div>

              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit(false)}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
                >
                  {submitting ? t('sending') : t('submit')}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit(true)}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  {t('submitWithoutGps')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
