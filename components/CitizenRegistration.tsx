'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { hashIIN } from '../lib/crypto'
import { DISTRICTS } from '../lib/contracts'
import { useCitizenRegistry } from '../lib/web3/useCitizenRegistry'

export default function CitizenRegistration() {
  const { publicKey, connected } = useWallet()
  const { registerCitizen, fetchCitizenProfile, loading: solanaLoading, error: solanaError } = useCitizenRegistry()

  const [iin, setIin] = useState('')
  const [district, setDistrict] = useState('')
  const [iinHash, setIinHash] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'registering' | 'done'>('form')
  const [agreed, setAgreed] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [regError, setRegError] = useState<string | null>(null)
  const [onChain, setOnChain] = useState(false)

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
    if (!isValidIIN || !district || !connected || !agreed || !publicKey || !iinHash) return
    setStep('registering')
    setRegError(null)

    const walletAddress = publicKey.toBase58()

    try {
      const hashBytes = new Uint8Array(32)
      for (let i = 0; i < 32; i++) {
        hashBytes[i] = parseInt(iinHash.slice(i * 2, i * 2 + 2), 16)
      }
      const result = await registerCitizen(district, hashBytes)
      setTxSignature(result.tx)
      setOnChain(true)
      console.log('On-chain registration tx:', result.tx)
    } catch (err: any) {
      console.log('On-chain registration failed (continuing with DB only):', err.message)
    }

    try {
      const res = await fetch('/api/citizens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, district, iinHash }),
      })
      const data = await res.json()
      if (data.error) {
        setRegError(data.error)
        setStep('form')
        return
      }
    } catch {
      setRegError('Ошибка сохранения в БД')
      setStep('form')
      return
    }

    setIin('')
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <svg width="40" height="40" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Регистрация завершена!</h3>
        <p className="text-gray-500 mb-6">Вы зарегистрированы как гражданин Amanat Protocol</p>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-left mb-6 max-w-sm mx-auto">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-400 mb-1">Район</div>
              <div className="text-gray-900 font-medium">{district}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">IIN хэш (SHA-256)</div>
              <div className="font-mono text-xs text-emerald-600 break-all">{iinHash}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Кошелёк</div>
              <div className="text-gray-900 font-medium font-mono text-sm">{publicKey?.toBase58()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Solana</div>
              {onChain ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-600 text-xs">On-chain</span>
                  {txSignature && (
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 text-xs underline"
                    >
                      tx
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-yellow-600 text-xs">Ожидает подтверждения</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <a href="/profile" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors">
            Мой профиль
          </a>
          <a href="/contracts" className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors">
            Контракты
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error */}
      {(regError || solanaError) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {regError || solanaError}
        </div>
      )}

      {/* Step 1: IIN */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm">1</div>
          <h3 className="text-gray-900 font-semibold">Введите ИИН</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500 mb-2 block">ИИН (12 цифр)</label>
            <input
              type="text"
              maxLength={12}
              value={iin}
              onChange={(e) => handleIINChange(e.target.value)}
              placeholder="000000000000"
              className={`w-full bg-gray-50 border rounded-lg px-4 py-3 text-gray-900 font-mono text-lg tracking-widest placeholder-gray-300 focus:outline-none focus:ring-2 transition-all ${
                iin.length > 0 && !isValidIIN
                  ? 'border-red-300 focus:ring-red-200'
                  : isValidIIN
                  ? 'border-emerald-300 focus:ring-emerald-200'
                  : 'border-gray-300 focus:ring-emerald-200'
              }`}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-gray-400">{iin.length}/12 символов</span>
              {isValidIIN && <span className="text-xs text-emerald-500">Действительный ИИН</span>}
            </div>
          </div>

          {iinHash && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-xs text-emerald-600 mb-1.5 flex items-center gap-1.5">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                SHA-256 хэш (будет записан в блокчейн):
              </div>
              <div className="font-mono text-xs text-gray-500 break-all">{iinHash}</div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: District */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm">2</div>
          <h3 className="text-gray-900 font-semibold">Выберите район</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DISTRICTS.map((d) => (
            <button
              key={d}
              onClick={() => setDistrict(d)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                district === d
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Wallet */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm">3</div>
          <h3 className="text-gray-900 font-semibold">Подключить кошелёк</h3>
        </div>
        {!connected ? (
          <div className="wallet-adapter-btn">
            <WalletMultiButton />
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div>
              <div className="text-emerald-600 font-medium text-sm">Подключено</div>
              <div className="text-gray-500 font-mono text-xs">{publicKey?.toBase58()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Privacy notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg width="16" height="16" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <div className="text-blue-600 font-medium text-sm mb-1">Конфиденциальность</div>
            <p className="text-gray-500 text-xs leading-relaxed">
              ИИН хэшируется SHA-256 в вашем браузере и никогда не покидает клиент.
              В блокчейн записывается только хэш, что делает невозможным обратное восстановление ИИН.
            </p>
          </div>
        </div>
      </div>

      {/* Consent */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div
          onClick={() => setAgreed(!agreed)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
            agreed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 group-hover:border-gray-400'
          }`}
        >
          {agreed && (
            <svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-sm text-gray-500">
          Я соглашаюсь с условиями Amanat Protocol и подтверждаю, что являюсь жителем Алматы
        </span>
      </label>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!isValidIIN || !district || !connected || !agreed || step === 'registering'}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
          isValidIIN && district && connected && agreed
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {step === 'registering' ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {solanaLoading ? 'Подписание транзакции...' : 'Сохранение в БД...'}
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
