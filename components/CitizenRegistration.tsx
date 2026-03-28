'use client'

import { useState } from 'react'
import { hashIIN } from '../lib/crypto'
import { DISTRICTS } from '../lib/contracts'

export default function CitizenRegistration() {
  const [iin, setIin] = useState('')
  const [district, setDistrict] = useState('')
  const [iinHash, setIinHash] = useState<string | null>(null)
  const [walletConnected, setWalletConnected] = useState(false)
  const [step, setStep] = useState<'form' | 'hashing' | 'done'>('form')
  const [agreed, setAgreed] = useState(false)

  const isValidIIN = iin.length === 12 && /^\d+$/.test(iin)

  const handleIINChange = async (value: string) => {
    setIin(value)
    setIinHash(null)
    if (value.length === 12 && /^\d+$/.test(value)) {
      const hash = await hashIIN(value)
      setIinHash(hash)
    }
  }

  const handleSubmit = async () => {
    if (!isValidIIN || !district || !walletConnected || !agreed) return
    setStep('hashing')
    await new Promise((r) => setTimeout(r, 1500))
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <svg width="40" height="40" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Регистрация завершена!</h3>
        <p className="text-gray-400 mb-6">Вы успешно зарегистрированы как гражданин Amanat Protocol</p>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-left mb-6 max-w-sm mx-auto">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Район</div>
              <div className="text-white font-medium">{district}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">IIN хэш (SHA-256)</div>
              <div className="font-mono text-xs text-emerald-400 break-all">{iinHash}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Кошелёк</div>
              <div className="text-white font-medium font-mono text-sm">0xA3...f9D2</div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <a href="/profile" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors">
            Мой профиль
          </a>
          <a href="/contracts" className="px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors">
            Контракты
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Step 1: IIN */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">1</div>
          <h3 className="text-white font-semibold">Введите ИИН</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">ИИН (12 цифр)</label>
            <input
              type="text"
              maxLength={12}
              value={iin}
              onChange={(e) => handleIINChange(e.target.value)}
              placeholder="000000000000"
              className={`w-full bg-gray-950 border rounded-lg px-4 py-3 text-white font-mono text-lg tracking-widest placeholder-gray-700 focus:outline-none focus:ring-2 transition-all ${
                iin.length > 0 && !isValidIIN
                  ? 'border-red-500/50 focus:ring-red-500/30'
                  : isValidIIN
                  ? 'border-emerald-500/50 focus:ring-emerald-500/30'
                  : 'border-gray-700 focus:ring-emerald-500/30'
              }`}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-gray-600">{iin.length}/12 символов</span>
              {isValidIIN && <span className="text-xs text-emerald-400">Действительный ИИН</span>}
              {iin.length > 0 && !isValidIIN && (
                <span className="text-xs text-red-400">Только 12 цифр</span>
              )}
            </div>
          </div>

          {/* Hash preview */}
          {iinHash && (
            <div className="bg-gray-950 border border-emerald-500/20 rounded-lg p-3">
              <div className="text-xs text-emerald-400/70 mb-1.5 flex items-center gap-1.5">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                SHA-256 хэш (будет записан в блокчейн):
              </div>
              <div className="font-mono text-xs text-gray-400 break-all">{iinHash}</div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: District */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">2</div>
          <h3 className="text-white font-semibold">Выберите район</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DISTRICTS.map((d) => (
            <button
              key={d}
              onClick={() => setDistrict(d)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                district === d
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-gray-950 text-gray-400 border border-gray-800 hover:border-gray-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Wallet */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">3</div>
          <h3 className="text-white font-semibold">Подключить кошелёк</h3>
        </div>
        {!walletConnected ? (
          <button
            onClick={() => setWalletConnected(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold hover:from-purple-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 12V22H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
            </svg>
            Подключить Phantom Wallet
          </button>
        ) : (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div>
              <div className="text-emerald-400 font-medium text-sm">Подключено</div>
              <div className="text-gray-400 font-mono text-xs">0xA3f2...9D2b</div>
            </div>
          </div>
        )}
      </div>

      {/* Privacy notice */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg width="16" height="16" fill="none" stroke="#60a5fa" strokeWidth="2" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <div className="text-blue-400 font-medium text-sm mb-1">Конфиденциальность</div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Ваш ИИН никогда не покидает ваш браузер. Мы используем SHA-256 хэширование на стороне клиента.
              В блокчейн записывается только хэш, что делает невозможным обратное восстановление ИИН.
              Хэш служит уникальным идентификатором для предотвращения дублирования.
            </p>
          </div>
        </div>
      </div>

      {/* Consent */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div
          onClick={() => setAgreed(!agreed)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
            agreed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600 group-hover:border-gray-400'
          }`}
        >
          {agreed && (
            <svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-sm text-gray-400">
          Я соглашаюсь с условиями использования Amanat Protocol и подтверждаю, что являюсь жителем Алматы
        </span>
      </label>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!isValidIIN || !district || !walletConnected || !agreed || step === 'hashing'}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
          isValidIIN && district && walletConnected && agreed
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-xl shadow-emerald-500/30'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
        }`}
      >
        {step === 'hashing' ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Регистрация...
          </>
        ) : (
          <>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Зарегистрироваться
          </>
        )}
      </button>
    </div>
  )
}
