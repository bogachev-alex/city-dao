'use client'

import { useState } from 'react'
import { DISTRICTS } from '../../lib/contracts'

interface MilestoneInput {
  desc: string
  deadline_days: number
  tranche_pct: number
}

interface ContractFormData {
  title: string
  contractor: string
  amount_usdc: number | ''
  deadline: string
  district: string
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
  lat: '43.2551',
  lng: '76.9126',
  milestones: [
    { desc: '', deadline_days: 10, tranche_pct: 50 },
    { desc: '', deadline_days: 20, tranche_pct: 50 },
  ],
}

export default function AdminPage() {
  const [form, setForm] = useState<ContractFormData>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<'general' | 'milestones'>('general')

  const totalTranche = form.milestones.reduce((sum, m) => sum + (m.tranche_pct || 0), 0)
  const trancheValid = totalTranche === 100

  const handleSubmit = async () => {
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 1800))
    setSubmitting(false)
    setSubmitted(true)
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
      <div className="min-h-screen pt-16 bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <svg width="48" height="48" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Контракт зарегистрирован!</h2>
          <p className="text-gray-500 mb-6">Контракт добавлен в реестр и будет отображаться на карте через несколько минут.</p>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-left mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Название</span>
              <span className="text-gray-900 font-medium truncate max-w-[200px]">{form.title || 'Без названия'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Подрядчик</span>
              <span className="text-gray-900">{form.contractor}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Эскроу (20%)</span>
              <span className="text-emerald-600 font-medium">
                {form.amount_usdc ? Math.round(Number(form.amount_usdc) * 0.2).toLocaleString() : '0'} USDC
              </span>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <a href="/contracts" className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors">
              Смотреть реестр
            </a>
            <button
              onClick={() => { setForm(INITIAL_FORM); setSubmitted(false); }}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Добавить ещё
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-b from-white to-gray-50 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Регистрация контракта</h1>
          </div>
          <p className="text-gray-500 ml-14">Добавьте новый государственный контракт в систему мониторинга</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Tab nav */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6">
          {[
            { id: 'general', label: 'Общая информация' },
            { id: 'milestones', label: `Этапы (${form.milestones.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as 'general' | 'milestones')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === tab.id
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* General section */}
        {activeSection === 'general' && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <h2 className="text-gray-900 font-semibold mb-4">Данные контракта</h2>

              <div>
                <label className="text-sm text-gray-500 block mb-1.5">Название контракта</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ремонт дороги на ул. Абая..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 block mb-1.5">Подрядчик (ТОО/АО)</label>
                  <input
                    type="text"
                    value={form.contractor}
                    onChange={(e) => setForm({ ...form, contractor: e.target.value })}
                    placeholder="ТОО СтройАлматы"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1.5">Сумма (USDC)</label>
                  <input
                    type="number"
                    value={form.amount_usdc}
                    onChange={(e) => setForm({ ...form, amount_usdc: e.target.value ? Number(e.target.value) : '' })}
                    placeholder="100000"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 text-sm"
                  />
                  {form.amount_usdc && (
                    <div className="text-xs text-emerald-500 mt-1">
                      Эскроу (20%): {Math.round(Number(form.amount_usdc) * 0.2).toLocaleString()} USDC
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 block mb-1.5">Дедлайн</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-emerald-400 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1.5">Район</label>
                  <select
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-emerald-400 text-sm"
                  >
                    <option value="">Выберите район</option>
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 block mb-1.5">Широта</label>
                  <input
                    type="text"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 font-mono text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1.5">Долгота</label>
                  <input
                    type="text"
                    value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 font-mono text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveSection('milestones')}
              className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium text-sm hover:bg-emerald-100 transition-colors"
            >
              Далее: Этапы контракта →
            </button>
          </div>
        )}

        {/* Milestones section */}
        {activeSection === 'milestones' && (
          <div className="space-y-4">
            <div className={`bg-white border rounded-xl p-4 flex items-center justify-between ${
              trancheValid ? 'border-emerald-200' : 'border-yellow-200'
            }`}>
              <div className="text-sm">
                <span className="text-gray-500">Сумма траншей: </span>
                <span className={`font-bold ${trancheValid ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  {totalTranche}%
                </span>
                <span className="text-gray-400"> / 100%</span>
              </div>
              {!trancheValid && (
                <span className="text-xs text-yellow-600">Должно быть ровно 100%</span>
              )}
            </div>

            {form.milestones.map((milestone, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 text-xs font-bold">
                      {idx + 1}
                    </div>
                    <span className="text-gray-900 font-medium text-sm">Этап {idx + 1}</span>
                  </div>
                  {form.milestones.length > 1 && (
                    <button
                      onClick={() => removeMilestone(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
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
                    placeholder="Описание работ этапа..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Срок (дней)</label>
                      <input
                        type="number"
                        value={milestone.deadline_days}
                        onChange={(e) => updateMilestone(idx, 'deadline_days', Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Транш (%)</label>
                      <input
                        type="number"
                        value={milestone.tranche_pct}
                        onChange={(e) => updateMilestone(idx, 'tranche_pct', Number(e.target.value))}
                        max={100}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addMilestone}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 text-sm hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
              Добавить этап
            </button>

            <button
              onClick={handleSubmit}
              disabled={!form.title || !form.contractor || !form.amount_usdc || !form.district || !trancheValid || submitting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                form.title && form.contractor && form.amount_usdc && form.district && trancheValid
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Регистрация в блокчейн...
                </>
              ) : (
                <>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Зарегистрировать контракт
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
