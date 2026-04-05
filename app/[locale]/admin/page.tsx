'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { useWallet } from '@solana/wallet-adapter-react'
import { useConnection } from '@solana/wallet-adapter-react'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { DISTRICTS, formatTengeWithCrypto, getSolanaExplorerTxUrl } from '@/lib/contracts'
import { createContract, fetchContractors } from '@/lib/api'
import { useContractRegistry } from '@/lib/web3/useContractRegistry'
import { tengeToLamports, lamportsToTenge } from '@/lib/web3/constants'
import { useAuth } from '@/components/AuthContext'

interface MilestoneInput {
  desc: string
  deadline_days: number
  tranche_pct: number
}

const CATEGORIES = [
  'Дороги',
  'Электросети',
  'Водоснабжение',
  'Социальные объекты',
  'Озеленение',
  'Безопасность',
  'Образование',
  'Инфраструктура',
]

interface ContractorOption {
  id: string
  name: string
  rating: string
  _count?: { contracts: number }
}

interface ContractFormData {
  title: string
  contractor: string
  contractorId: string
  amount_usdc: number | ''
  deadline: string
  district: string
  category: string
  lat: string
  lng: string
  milestones: MilestoneInput[]
}

const INITIAL_FORM: ContractFormData = {
  title: '',
  contractor: '',
  contractorId: '',
  amount_usdc: '',
  deadline: '',
  district: '',
  category: '',
  lat: '43.2551',
  lng: '76.9126',
  milestones: [
    { desc: '', deadline_days: 10, tranche_pct: 50 },
    { desc: '', deadline_days: 20, tranche_pct: 50 },
  ],
}

export default function AdminPage() {
  const t = useTranslations('admin')
  const { user, loading, authHeader } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState<ContractFormData>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<'general' | 'milestones'>('general')
  const [error, setError] = useState<string | null>(null)
  const [submitStep, setSubmitStep] = useState<'db' | 'blockchain' | null>(null)
  const [onChainTx, setOnChainTx] = useState<string | null>(null)
  const [onChainPda, setOnChainPda] = useState<string | null>(null)

  const [contractors, setContractors] = useState<ContractorOption[]>([])

  const wallet = useWallet()
  const { connection } = useConnection()
  const { registerContract: registerContractOnChain } = useContractRegistry()
  const pendingConnectRef = useRef(false)

  useEffect(() => {
    if (pendingConnectRef.current && wallet.wallet && !wallet.connected && !wallet.connecting) {
      pendingConnectRef.current = false
      wallet.connect().catch(() => {})
    }
  }, [wallet.wallet?.adapter.name, wallet.connected, wallet.connecting, wallet.connect])

  const handleConnectWallet = useCallback(() => {
    const isUsable = (s: WalletReadyState) => s === WalletReadyState.Installed || s === WalletReadyState.Loadable
    const phantom = wallet.wallets.find((w) => w.adapter.name === 'Phantom' && isUsable(w.readyState))
    const anyUsable = wallet.wallets.find((w) => isUsable(w.readyState))
    const target = phantom || anyUsable
    if (!target) {
      window.open('https://phantom.app/', '_blank')
      return
    }
    if (wallet.wallet?.adapter.name === target.adapter.name) {
      wallet.connect().catch(() => {})
      return
    }
    pendingConnectRef.current = true
    wallet.select(target.adapter.name)
  }, [wallet])

  useEffect(() => {
    if (!loading && user?.role !== 'AKIMAT') {
      router.replace('/' as any)
    }
  }, [user, loading, router])

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchContractors()
        if (Array.isArray(data)) setContractors(data)
      } catch {}
    }
    void load()
  }, [])

  const totalTranche = form.milestones.reduce((sum, m) => sum + (m.tranche_pct || 0), 0)
  const trancheValid = totalTranche === 100

  const ALMATY_BOUNDS = {
    latMin: 43.18, latMax: 43.35,
    lngMin: 76.75, lngMax: 77.05,
  }

  const randomAlmatyCoords = () => {
    const lat = (ALMATY_BOUNDS.latMin + Math.random() * (ALMATY_BOUNDS.latMax - ALMATY_BOUNDS.latMin)).toFixed(4)
    const lng = (ALMATY_BOUNDS.lngMin + Math.random() * (ALMATY_BOUNDS.lngMax - ALMATY_BOUNDS.lngMin)).toFixed(4)
    return { lat, lng }
  }

  const fillTestData = () => {
    const now = Date.now()
    const suffix = String(now).slice(-4)
    const deadline = new Date(now + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const defaultContractor = contractors.length > 0 ? contractors[0] : null
    const coords = randomAlmatyCoords()
    setForm({
      title: `Тестовый контракт #${suffix}: ремонт тротуара`,
      contractor: defaultContractor?.name || 'ТОО ТестПодряд',
      contractorId: defaultContractor?.id || '',
      amount_usdc: 120000000,
      deadline,
      district: DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)],
      category: CATEGORIES[0],
      lat: coords.lat,
      lng: coords.lng,
      milestones: [
        { desc: 'Подготовка участка и демонтаж', deadline_days: 10, tranche_pct: 30 },
        { desc: 'Основные строительные работы', deadline_days: 25, tranche_pct: 50 },
        { desc: 'Приемка и финальная уборка', deadline_days: 45, tranche_pct: 20 },
      ],
    })
    setError(null)
  }

  const handleSubmit = async () => {
    if (!wallet.publicKey) {
      setError(t('connectWalletHint'))
      return
    }

    setSubmitting(true)
    setError(null)
    setSubmitStep('blockchain')

    try {
      // 0) Ensure sufficient SOL for rent
      if (wallet.publicKey) {
        const minRent = 0.01 * LAMPORTS_PER_SOL
        const balance = await connection.getBalance(wallet.publicKey)
        if (balance < minRent) {
          const sig = await connection.requestAirdrop(wallet.publicKey, Math.floor(0.05 * LAMPORTS_PER_SOL))
          await connection.confirmTransaction(sig, 'confirmed')
        }
      }

      // 1) Must be registered on-chain first
      // Convert tenge → lamports. Cap so the 20% escrow deposit doesn't drain the wallet,
      // but ensure it's large enough to cover rent-exempt minimum (~0.001 SOL).
      const fullLamports = tengeToLamports(Number(form.amount_usdc))
      const walletBalance = wallet.publicKey ? await connection.getBalance(wallet.publicKey) : 0
      const maxEscrowLamports = Math.floor(walletBalance * 0.3)
      const maxTotalForEscrow = Math.floor(maxEscrowLamports / 0.2)
      const rentExemptMinimum = 2_000_000 // ~0.002 SOL, safe margin
      const minTotal = Math.ceil(rentExemptMinimum / 0.2) // 10M lamports
      const onChainAmount = Math.max(minTotal, Math.min(fullLamports, maxTotalForEscrow))
      const result = await registerContractOnChain(
        form.title,
        form.district,
        onChainAmount,
        new Date(form.deadline).getTime() / 1000,
        form.milestones.map((m) => ({
          description: m.desc,
          deadlineDays: m.deadline_days,
          tranchePct: m.tranche_pct,
        })),
        parseFloat(form.lat),
        parseFloat(form.lng),
        wallet.publicKey
      )

      if (!result?.pda) {
        throw new Error('Не удалось получить on-chain адрес контракта')
      }
      setOnChainTx(result.tx || null)
      setOnChainPda(result.pda)

      // 2) Save to database with linked on-chain pubkey
      setSubmitStep('db')
      const contractData = {
        title: form.title,
        contractorName: form.contractor,
        contractorId: form.contractorId || undefined,
        totalAmount: Number(form.amount_usdc),
        deadline: form.deadline,
        district: form.district,
        category: form.category || undefined,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        milestones: form.milestones.map((m) => ({
          description: m.desc,
          deadlineDays: m.deadline_days,
          tranchePct: m.tranche_pct,
        })),
        onChainPubkey: result.pda,
      }

      await createContract(contractData, authHeader())

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || t('errorGeneric'))
    } finally {
      setSubmitting(false)
      setSubmitStep(null)
    }
  }

  const addMilestone = () => {
    setForm((f) => ({
      ...f,
      milestones: [...f.milestones, { desc: '', deadline_days: 30, tranche_pct: 0 }],
    }))
  }

  const removeMilestone = (idx: number) => {
    setForm((f) => ({
      ...f,
      milestones: f.milestones.filter((_, i) => i !== idx),
    }))
  }

  const updateMilestone = (idx: number, field: keyof MilestoneInput, value: string | number) => {
    setForm((f) => ({
      ...f,
      milestones: f.milestones.map((m, i) => (i === idx ? { ...m, [field]: value } : m)),
    }))
  }

  if (loading || user?.role !== 'AKIMAT') {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <svg width="48" height="48" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('contractRegistered')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{t('contractAdded')}</p>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-left mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 dark:text-gray-500">{t('nameLabel')}</span>
              <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">{form.title || t('noTitle')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 dark:text-gray-500">{t('contractorLabel')}</span>
              <span className="text-gray-900 dark:text-white">{form.contractor}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 dark:text-gray-500">{t('escrow20')}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {form.amount_usdc ? formatTengeWithCrypto(Math.round(Number(form.amount_usdc) * 0.2)) : '0 ₸'}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">TX Signature</div>
              {onChainTx ? (
                <div className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{onChainTx}</div>
              ) : (
                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                  No on-chain tx signature returned (possible PDA reuse).
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">On-chain contract PDA</div>
              <div className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">
                {onChainPda || '-'}
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            {onChainTx && (
              <a
                href={getSolanaExplorerTxUrl(onChainTx)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 rounded-xl font-medium hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors"
              >
                Open in Explorer
              </a>
            )}
            <Link href="/contracts" className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors">
              {t('viewRegistry')}
            </Link>
            <button
              onClick={() => {
                setForm(INITIAL_FORM)
                setSubmitted(false)
                setError(null)
                setOnChainTx(null)
                setOnChainPda(null)
              }}
              className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {t('addMore')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center">
                <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('registerContract')}</h1>
            </div>
            <button
              type="button"
              onClick={fillTestData}
              className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors"
            >
              {t('fillTestData')}
            </button>
          </div>
          <p className="text-gray-500 dark:text-gray-400 ml-14">{t('addDescription')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Error display */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <svg width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">{t('error')}</p>
              <p className="text-red-500 dark:text-red-400/80 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Wallet connection */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-500/20 flex items-center justify-center">
              <svg width="14" height="14" fill="none" stroke="#8b5cf6" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <span className="text-gray-900 dark:text-white font-semibold text-sm">{t('walletSolana')}</span>
            <span className="ml-auto text-xs text-red-500 dark:text-red-400 font-medium">{t('walletRequired')}</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 ml-10">
            {t('walletHint')}
          </p>
          {!wallet.connected ? (
            <button
              onClick={handleConnectWallet}
              disabled={wallet.connecting}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {wallet.connecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('walletConnecting')}
                </>
              ) : (
                <>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  {t('walletConnect')}
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">{t('walletConnected')}</div>
                <div className="text-gray-500 dark:text-gray-400 font-mono text-xs truncate">{wallet.publicKey?.toBase58()}</div>
              </div>
              <span className="text-xs text-gray-400">akimat</span>
            </div>
          )}
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 mb-6">
          {[
            { id: 'general', label: t('generalInfo') },
            { id: 'milestones', label: `${t('milestonesTab')} (${form.milestones.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as 'general' | 'milestones')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === tab.id
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* General section */}
        {activeSection === 'general' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
              <h2 className="text-gray-900 dark:text-white font-semibold mb-4">{t('contractData')}</h2>

              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">{t('contractName')}</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('contractNamePlaceholder')}
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">{t('contractorLabel')}</label>
                  <select
                    value={form.contractorId}
                    onChange={(e) => {
                      const c = contractors.find((x) => x.id === e.target.value)
                      if (c) {
                        setForm({ ...form, contractor: c.name, contractorId: c.id })
                      } else {
                        setForm({ ...form, contractor: '', contractorId: '' })
                      }
                    }}
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm appearance-none"
                  >
                    <option value="">{t('selectContractor')}</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.rating}, {c._count?.contracts ?? 0} контр.)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">{t('amountLabel')}</label>
                  <input
                    type="number"
                    value={form.amount_usdc}
                    onChange={(e) => setForm({ ...form, amount_usdc: e.target.value ? Number(e.target.value) : '' })}
                    placeholder="100000"
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                  />
                  {form.amount_usdc && (
                    <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-1 space-y-0.5">
                      <div>{t('escrow20')}: {formatTengeWithCrypto(Math.round(Number(form.amount_usdc) * 0.2))}</div>
                      <div className="text-gray-400 dark:text-gray-500">On-chain: {(tengeToLamports(Number(form.amount_usdc)) / LAMPORTS_PER_SOL).toFixed(4)} SOL</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">{t('deadlineLabel')}</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">{t('districtLabel')}</label>
                  <select
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                  >
                    <option value="">{t('selectDistrict')}</option>
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">{t('category')}</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                >
                  <option value="">{t('selectCategory')}</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">{t('latitude')}</label>
                  <input
                    type="text"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">{t('longitude')}</label>
                  <input
                    type="text"
                    value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveSection('milestones')}
              className="w-full py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-medium text-sm hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition-colors"
            >
              {t('nextMilestones')}
            </button>
          </div>
        )}

        {/* Milestones section */}
        {activeSection === 'milestones' && (
          <div className="space-y-4">
            <div className={`bg-white dark:bg-gray-900 border rounded-xl p-4 flex items-center justify-between ${
              trancheValid ? 'border-emerald-200 dark:border-emerald-500/30' : 'border-yellow-200 dark:border-yellow-500/30'
            }`}>
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('trancheSum')} </span>
                <span className={`font-bold ${trancheValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {totalTranche}%
                </span>
                <span className="text-gray-400 dark:text-gray-500"> / 100%</span>
              </div>
              {!trancheValid && (
                <span className="text-xs text-yellow-600 dark:text-yellow-400">{t('mustBe100')}</span>
              )}
            </div>

            {form.milestones.map((milestone, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                      {idx + 1}
                    </div>
                    <span className="text-gray-900 dark:text-white font-medium text-sm">{t('milestone')} {idx + 1}</span>
                  </div>
                  {form.milestones.length > 1 && (
                    <button
                      onClick={() => removeMilestone(idx)}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={milestone.desc}
                    onChange={(e) => updateMilestone(idx, 'desc', e.target.value)}
                    placeholder={t('milestoneDescPlaceholder')}
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">{t('termDays')}</label>
                      <input
                        type="number"
                        value={milestone.deadline_days}
                        onChange={(e) => updateMilestone(idx, 'deadline_days', Number(e.target.value))}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">{t('tranchePct')}</label>
                      <input
                        type="number"
                        value={milestone.tranche_pct}
                        onChange={(e) => updateMilestone(idx, 'tranche_pct', Number(e.target.value))}
                        max={100}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addMilestone}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 text-sm hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
              {t('addMilestone')}
            </button>

            <button
              onClick={handleSubmit}
              disabled={!wallet.publicKey || !form.title || !form.contractor || !form.amount_usdc || !form.district || !trancheValid || submitting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                wallet.publicKey && form.title && form.contractor && form.amount_usdc && form.district && trancheValid
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {submitStep === 'db' ? t('submitting') : submitStep === 'blockchain' ? t('submittingBlockchain') || 'Регистрация в блокчейн...' : t('submitting')}
                </>
              ) : (
                <>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('submitButton')}
                </>
              )}
            </button>
            {!wallet.publicKey && (
              <div className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                {t('connectWalletForChain')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
