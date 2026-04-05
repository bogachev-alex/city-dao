'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import PhotoEvidenceUpload from '@/components/contractor/PhotoEvidenceUpload'
import { useContractRegistry } from '@/lib/web3/useContractRegistry'

type Milestone = {
  id: string
  status: string
  description: string
  sortOrder: number
}

type ContractOption = {
  id: string
  title: string
  onChainPubkey?: string | null
  milestones: Milestone[]
}

type Props = {
  open: boolean
  onClose: () => void
  contracts: ContractOption[]
  contractorWalletAddress?: string | null
  authHeader: () => Record<string, string>
  onSuccess: () => void
}

function buildEvidenceHash(cids: string[]): string {
  if (!cids.length) return 'no-evidence'
  const s = cids.join('|')
  return s.length > 200 ? s.slice(0, 200) : s
}

const MIN_SOL_FOR_TX = 0.01

export default function MilestoneSubmitModal({
  open,
  onClose,
  contracts,
  contractorWalletAddress,
  authHeader,
  onSuccess,
}: Props) {
  const t = useTranslations('contractorPage.milestoneSubmit')
  const { connection } = useConnection()
  const wallet = useWallet()
  const { submitMilestone, loading: chainLoading, error: chainError } = useContractRegistry()

  const [contractId, setContractId] = useState('')
  const [milestoneId, setMilestoneId] = useState('')
  const [note, setNote] = useState('')
  const [photoHashes, setPhotoHashes] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const submitInFlightRef = useRef(false)
  const [solBalance, setSolBalance] = useState<number | null>(null)

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === contractId) ?? contracts[0],
    [contracts, contractId]
  )

  const eligibleMilestones = useMemo(() => {
    const ms = selectedContract?.milestones ?? []
    const ok = (s: string) => {
      const u = s.toUpperCase()
      return u === 'PENDING' || u === 'SUBMITTED'
    }
    return [...ms].sort((a, b) => a.sortOrder - b.sortOrder).filter((m) => ok(m.status))
  }, [selectedContract])

  const milestoneIndexOnChain = useMemo(() => {
    if (!selectedContract || !milestoneId) return -1
    const sorted = [...selectedContract.milestones].sort((a, b) => a.sortOrder - b.sortOrder)
    return sorted.findIndex((m) => m.id === milestoneId)
  }, [selectedContract, milestoneId])

  useEffect(() => {
    if (open && contracts.length && !contractId) {
      setContractId(contracts[0].id)
    }
  }, [open, contracts, contractId])

  useEffect(() => {
    if (eligibleMilestones.length && !eligibleMilestones.some((m) => m.id === milestoneId)) {
      setMilestoneId(eligibleMilestones[0].id)
    }
  }, [eligibleMilestones, milestoneId])

  useEffect(() => {
    let cancelled = false
    async function loadBal() {
      if (!wallet.publicKey) {
        setSolBalance(null)
        return
      }
      const lamports = await connection.getBalance(wallet.publicKey)
      if (!cancelled) setSolBalance(lamports / LAMPORTS_PER_SOL)
    }
    void loadBal()
    const id = wallet.publicKey ? window.setInterval(loadBal, 12_000) : undefined
    return () => {
      cancelled = true
      if (id) window.clearInterval(id)
    }
  }, [connection, wallet.publicKey, open])

  const reset = useCallback(() => {
    setNote('')
    setPhotoHashes([])
    setFormError(null)
  }, [])

  const walletMatches =
    !contractorWalletAddress ||
    !wallet.publicKey ||
    contractorWalletAddress === wallet.publicKey.toBase58()

  const lowSol = solBalance != null && solBalance < MIN_SOL_FOR_TX

  const submit = async () => {
    if (submitInFlightRef.current) return
    if (!selectedContract || !milestoneId) {
      setFormError(t('errorPick'))
      return
    }
    if (milestoneIndexOnChain < 0) {
      setFormError(t('errorIndex'))
      return
    }

    submitInFlightRef.current = true
    setFormError(null)
    setSubmitting(true)

    try {
      const res = await fetch(
        `/api/contracts/${encodeURIComponent(selectedContract.id)}/milestones/${encodeURIComponent(milestoneId)}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({
            photoHashes,
            evidenceNote: note.trim() || undefined,
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(typeof data.error === 'string' ? data.error : t('errorApi'))
        return
      }

      const pkStr = selectedContract.onChainPubkey
      if (pkStr && wallet.publicKey) {
        try {
          const evidenceHash = buildEvidenceHash(photoHashes)
          await submitMilestone(new PublicKey(pkStr), milestoneIndexOnChain, evidenceHash)
        } catch (e: unknown) {
          setFormError(e instanceof Error ? e.message : t('errorChain'))
          return
        }
      }

      reset()
      onSuccess()
      onClose()
    } catch {
      setFormError(t('errorApi'))
    } finally {
      submitInFlightRef.current = false
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-submit-title"
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 id="milestone-submit-title" className="text-lg font-semibold text-gray-900 dark:text-white">
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
          ) : eligibleMilestones.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noMilestones')}</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('contract')}</label>
                <select
                  value={contractId || contracts[0]?.id}
                  onChange={(e) => {
                    setContractId(e.target.value)
                    setMilestoneId('')
                  }}
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('milestone')}</label>
                <select
                  value={milestoneId || eligibleMilestones[0]?.id}
                  onChange={(e) => setMilestoneId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {eligibleMilestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.description.slice(0, 72)}
                      {m.description.length > 72 ? '…' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('note')}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  placeholder={t('notePlaceholder')}
                />
              </div>

              <PhotoEvidenceUpload value={photoHashes} onChange={setPhotoHashes} authHeader={authHeader} disabled={submitting || chainLoading} />

              {selectedContract?.onChainPubkey && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-2 text-amber-900 dark:text-amber-200">
                  <p>{t('chainHint')}</p>
                  {!wallet.publicKey && <p>{t('connectWallet')}</p>}
                  {wallet.publicKey && lowSol && <p>{t('lowSol', { min: MIN_SOL_FOR_TX, balance: solBalance?.toFixed(4) ?? '—' })}</p>}
                  {wallet.publicKey && !walletMatches && (
                    <p>{t('walletMismatch', { expected: contractorWalletAddress ?? '—' })}</p>
                  )}
                  {chainError && <p className="text-red-600 dark:text-red-400">{chainError}</p>}
                </div>
              )}

              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

              <button
                type="button"
                disabled={submitting || chainLoading}
                onClick={() => void submit()}
                className="w-full inline-flex justify-center px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
              >
                {submitting || chainLoading ? t('sending') : t('submit')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
