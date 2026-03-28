'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton as WalletMultiButtonUnstyled } from '@solana/wallet-adapter-react-ui'
import { DISTRICTS } from '@/lib/contracts'
import { createContract } from '@/lib/api'
import { useContractRegistry } from '@/lib/web3/useContractRegistry'

const WalletMultiButton = WalletMultiButtonUnstyled as any

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

interface ContractFormData {
  title: string
  contractor: string
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
  const [form, setForm] = useState<ContractFormData>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<'general' | 'milestones'>('general')
  const [error, setError] = useState<string | null>(null)
  const [submitStep, setSubmitStep] = useState<'db' | 'blockchain' | null>(null)

  const wallet = useWallet()
  const { registerContract: registerContractOnChain } = useContractRegistry()

  const totalTranche = form.milestones.reduce((sum, m) => sum + (m.tranche_pct || 0), 0)
  const trancheValid = totalTranche === 100

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    setSubmitStep('db')

    try {
      // 1. Save to database
      const contractData = {
        title: form.title,
        contractorName: form.contractor,
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
      }

      const created = await createContract(contractData)

      // 2. Register on blockchain if wallet connected
      if (wallet.publicKey) {
        setSubmitStep('blockchain')
        try {
          const result = await registerContractOnChain(
            form.title,
            form.district,
            Number(form.amount_usdc),
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

          // Update DB record with on-chain pubkey
          if (result?.pda) {
            await fetch(`/api/contracts/${created.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ onChainPubkey: result.pda }),
            })
          }
        } catch (blockchainErr: any) {
          console.warn('Blockchain registration failed, contract saved to DB only:', blockchainErr)
        }
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании контракта')
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
                {form.amount_usdc ? Math.round(Number(form.amount_usdc) * 0.2).toLocaleString() : '0'} USDC
              </span>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <Link href="/contracts" className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors">
              {t('viewRegistry')}
            </Link>
            <button
              onClick={() => { setForm(INITIAL_FORM); setSubmitted(false); setError(null); }}
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
            <WalletMultiButton />
          </div>
          <p className="text-gray-500 dark:text-gray-400 ml-14">{t('addDescription')}</p>
          {!wallet.publicKey && (
            <p className="text-yellow-600 dark:text-yellow-400/80 text-xs ml-14 mt-1">
              {t('connectWalletHint') || 'Подключите кошелек для регистрации контракта в блокчейне'}
            </p>
          )}
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
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">Ошибка</p>
              <p className="text-red-500 dark:text-red-400/80 text-sm">{error}</p>
            </div>
          </div>
        )}

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
                  <input
                    type="text"
                    value={form.contractor}
                    onChange={(e) => setForm({ ...form, contractor: e.target.value })}
                    placeholder="ТОО СтройАлматы"
                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                  />
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
                    <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">
                      {t('escrow20')}: {Math.round(Number(form.amount_usdc) * 0.2).toLocaleString()} USDC
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
                <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">Категория</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 text-sm"
                >
                  <option value="">Выберите категорию</option>
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
              disabled={!form.title || !form.contractor || !form.amount_usdc || !form.district || !trancheValid || submitting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                form.title && form.contractor && form.amount_usdc && form.district && trancheValid
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
          </div>
        )}
      </div>
    </div>
  )
}
