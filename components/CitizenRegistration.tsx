'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useWallet } from '@solana/wallet-adapter-react'
import { useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import { Link } from '@/i18n/routing'
import { hashIIN } from '@/lib/crypto'
import { DISTRICTS, getSolanaExplorerTxUrl } from '@/lib/contracts'
import { useCitizenRegistry } from '@/lib/web3/useCitizenRegistry'
import { useAuth } from '@/components/AuthContext'
import type { AuthUser } from '@/lib/auth'

const PHONE_RE = /^\+7\s?\(?\d{3}\)?\s?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/

function formatPhone(raw: string): string {
  // Allow only digits and leading +
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return ''
  // Normalise to +7XXXXXXXXXX
  const d = digits.startsWith('7') ? digits : digits.startsWith('8') ? '7' + digits.slice(1) : digits
  let result = '+7'
  if (d.length > 1) result += ' (' + d.slice(1, 4)
  if (d.length >= 4) result += ') ' + d.slice(4, 7)
  if (d.length >= 7) result += '-' + d.slice(7, 9)
  if (d.length >= 9) result += '-' + d.slice(9, 11)
  return result
}

export default function CitizenRegistration() {
  const t = useTranslations('components.citizenRegistration')
  const { publicKey, connected, select, connect, wallets, wallet, connecting } = useWallet()
  const { connection } = useConnection()
  const { registerCitizen, fetchCitizenProfile, loading: solanaLoading, error: solanaError } = useCitizenRegistry()
  const { login, logout } = useAuth()

  const handleConnect = useCallback(() => {
    const phantom = wallets.find(
      (w) => w.adapter.name === 'Phantom' && w.readyState === WalletReadyState.Installed
    )
    const anyInstalled = wallets.find((w) => w.readyState === WalletReadyState.Installed)
    const target = phantom || anyInstalled
    if (!target) {
      window.open('https://phantom.app/', '_blank')
      return
    }
    if (wallet && wallet.adapter.name === target.adapter.name) {
      connect().catch(() => {})
      return
    }
    select(target.adapter.name)
    setTimeout(() => connect().catch(() => {}), 100)
  }, [wallets, wallet, select, connect])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [iin, setIin] = useState('')
  const [district, setDistrict] = useState('')
  const [iinHash, setIinHash] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'registering' | 'done'>('form')
  const [agreed, setAgreed] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [regError, setRegError] = useState<string | null>(null)
  const [regInfo, setRegInfo] = useState<string | null>(null)
  const [onChain, setOnChain] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const isValidIIN = iin.length === 12 && /^\d+$/.test(iin)
  const isValidPhone = PHONE_RE.test(phone)
  const isValidName = name.trim().length >= 2

  const handlePhoneChange = (raw: string) => {
    setPhone(formatPhone(raw))
  }

  const handleIINChange = async (value: string) => {
    setIin(value)
    setIinHash(null)
    if (value.length === 12 && /^\d+$/.test(value)) {
      const hash = await hashIIN(value)
      setIinHash(hash)
    }
  }

  const fillTestData = async () => {
    const testIin = '000000000001'
    setName('Test User')
    setPhone('+7 (700) 111-11-11')
    setDistrict(DISTRICTS[0])
    setAgreed(true)
    setIin(testIin)
    const hash = await hashIIN(testIin)
    setIinHash(hash)
    setRegError(null)
    setRegInfo(t('testDataFilled'))
  }

  const handleDeleteCitizen = async () => {
    if (!publicKey) {
      setRegError(t('deleteNeedWallet'))
      return
    }
    setDeleteLoading(true)
    setRegError(null)
    setRegInfo(null)
    try {
      const walletAddress = publicKey.toBase58()
      const res = await fetch('/api/citizens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRegError(data?.error || t('deleteFailed'))
        return
      }
      localStorage.removeItem('citizen')
      localStorage.removeItem('citizen_profile')
      logout()
      setStep('form')
      setTxSignature(null)
      setOnChain(false)
      setRegInfo(t('deleteSuccess'))
    } catch {
      setRegError(t('deleteFailed'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!isValidIIN || !isValidName || !isValidPhone || !district || !connected || !agreed || !publicKey || !iinHash) return
    setStep('registering')
    setRegError(null)
    setRegInfo(null)

    const walletAddress = publicKey.toBase58()

    try {
      const minFeeReserveLamports = Math.floor(0.0002 * LAMPORTS_PER_SOL)
      let balance = await connection.getBalance(publicKey)
      if (balance < minFeeReserveLamports) {
        try {
          const airdropSig = await connection.requestAirdrop(publicKey, Math.floor(0.01 * LAMPORTS_PER_SOL))
          await connection.confirmTransaction(airdropSig, 'confirmed')
          balance = await connection.getBalance(publicKey)
        } catch (airdropErr: any) {
          const msg = String(airdropErr?.message || '')
          const lowered = msg.toLowerCase()
          if (msg.includes('429') || lowered.includes('airdrop limit') || lowered.includes('faucet')) {
            setRegError(
              `Лимит testnet airdrop исчерпан. Пополните кошелёк тестовым SOL через https://faucet.solana.com и повторите регистрацию. Адрес: ${publicKey.toBase58()}`
            )
          } else {
            setRegError(`Не удалось получить testnet airdrop: ${msg || 'неизвестная ошибка'}`)
          }
          setStep('form')
          return
        }
      }
      if (balance < minFeeReserveLamports) {
        setRegError('Недостаточно SOL в testnet даже после airdrop. Повторите попытку через 10-20 секунд.')
        setStep('form')
        return
      }

      const existingOnChainProfile = await fetchCitizenProfile()
      if (existingOnChainProfile) {
        setOnChain(true)
        setRegInfo('On-chain профиль для этого кошелька уже существует. Используем существующую регистрацию.')
      } else {
        const hashBytes = new Uint8Array(32)
        for (let i = 0; i < 32; i++) {
          hashBytes[i] = parseInt(iinHash.slice(i * 2, i * 2 + 2), 16)
        }
        const result = await registerCitizen(district, hashBytes)
        setTxSignature(result.tx)
        setOnChain(true)
      }
    } catch (err: any) {
      const msg = String(err?.message || '')
      const lowered = msg.toLowerCase()
      if (lowered.includes('already in use') || lowered.includes('allocate: account') || lowered.includes('custom program error: 0x0')) {
        setOnChain(true)
        setRegInfo('On-chain профиль уже создан ранее для этого кошелька. Продолжаем регистрацию в БД.')
      } else {
        setOnChain(false)
        setRegError(`On-chain регистрация не выполнена: ${msg || 'неизвестная ошибка'}`)
        setStep('form')
        return
      }
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
      setRegError(t('dbSaveError'))
      setStep('form')
      return
    }

    setIin('')
    const trimmedName = name.trim()
    // Save profile data for login page to pick up
    localStorage.setItem('citizen', JSON.stringify({ district, walletAddress }))
    localStorage.setItem('citizen_profile', JSON.stringify({ name: trimmedName, phone, district, walletAddress }))

    // Auto-login with name from registration form
    const authUser: AuthUser = {
      role: 'CITIZEN',
      id: walletAddress,
      name: trimmedName || `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
    }
    login(authUser)
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <svg width="40" height="40" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('registrationDone')}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{t('registeredAs')}</p>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 text-left mb-6 max-w-sm mx-auto">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Имя</div>
              <div className="text-gray-900 dark:text-white font-medium">{name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Телефон</div>
              <div className="text-gray-900 dark:text-white font-medium">{phone}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('district')}</div>
              <div className="text-gray-900 dark:text-white font-medium">{district}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('iinHash')}</div>
              <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 break-all">{iinHash}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('wallet')}</div>
              <div className="text-gray-900 dark:text-white font-medium font-mono text-sm">{publicKey?.toBase58()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Solana</div>
              {onChain ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs">On-chain</span>
                  {txSignature && (
                    <a
                      href={getSolanaExplorerTxUrl(txSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 dark:text-blue-400 text-xs underline"
                    >
                      tx
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-yellow-600 dark:text-yellow-400 text-xs">{t('awaitingConfirmation')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/profile" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors">
            {t('myProfile')}
          </Link>
          <Link href="/" className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            На главную
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error */}
      {(regError || solanaError) && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
          {regError || solanaError}
        </div>
      )}
      {regInfo && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 text-sm text-emerald-700 dark:text-emerald-400">
          {regInfo}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void fillTestData()}
          className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors"
        >
          {t('fillTestData')}
        </button>
        <button
          type="button"
          onClick={() => void handleDeleteCitizen()}
          disabled={deleteLoading}
          className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-60"
        >
          {deleteLoading ? t('deleting') : t('deleteUser')}
        </button>
      </div>

      {/* Step 1: Personal info */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">1</div>
          <h3 className="text-gray-900 dark:text-white font-semibold">Личные данные</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400 mb-1.5 block">Полное имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Алибек Джаксыбеков"
              className={`w-full bg-gray-50 dark:bg-gray-950 border rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 transition-all text-sm ${
                name.length > 0 && !isValidName
                  ? 'border-red-300 dark:border-red-500/50 focus:ring-red-200 dark:focus:ring-red-500/30'
                  : isValidName
                  ? 'border-emerald-300 dark:border-emerald-500/50 focus:ring-emerald-200 dark:focus:ring-emerald-500/30'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-emerald-200 dark:focus:ring-emerald-500/30'
              }`}
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400 mb-1.5 block">Номер телефона</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+7 (700) 123-45-67"
              className={`w-full bg-gray-50 dark:bg-gray-950 border rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 transition-all text-sm font-mono ${
                phone.length > 0 && !isValidPhone
                  ? 'border-red-300 dark:border-red-500/50 focus:ring-red-200 dark:focus:ring-red-500/30'
                  : isValidPhone
                  ? 'border-emerald-300 dark:border-emerald-500/50 focus:ring-emerald-200 dark:focus:ring-emerald-500/30'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-emerald-200 dark:focus:ring-emerald-500/30'
              }`}
            />
            {phone.length > 0 && !isValidPhone && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">Введите корректный казахстанский номер</p>
            )}
          </div>
        </div>
      </div>

      {/* Step 2: IIN */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">2</div>
          <h3 className="text-gray-900 dark:text-white font-semibold">{t('enterIIN')}</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">{t('iinLabel')}</label>
            <input
              type="text"
              maxLength={12}
              value={iin}
              onChange={(e) => handleIINChange(e.target.value)}
              placeholder="000000000000"
              className={`w-full bg-gray-50 dark:bg-gray-950 border rounded-lg px-4 py-3 text-gray-900 dark:text-white font-mono text-lg tracking-widest placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:ring-2 transition-all ${
                iin.length > 0 && !isValidIIN
                  ? 'border-red-300 dark:border-red-500/50 focus:ring-red-200 dark:focus:ring-red-500/30'
                  : isValidIIN
                  ? 'border-emerald-300 dark:border-emerald-500/50 focus:ring-emerald-200 dark:focus:ring-emerald-500/30'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-emerald-200 dark:focus:ring-emerald-500/30'
              }`}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">{iin.length}/12 {t('chars')}</span>
              {isValidIIN && <span className="text-xs text-emerald-500 dark:text-emerald-400">{t('validIIN')}</span>}
            </div>
          </div>

          {iinHash && (
            <div className="bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-3">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1.5">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {t('sha256Hash')}
              </div>
              <div className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all">{iinHash}</div>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: District */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">3</div>
          <h3 className="text-gray-900 dark:text-white font-semibold">{t('selectDistrict')}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DISTRICTS.map((d) => (
            <button
              key={d}
              onClick={() => setDistrict(d)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                district === d
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/50'
                  : 'bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Step 4: Wallet (required) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">4</div>
          <h3 className="text-gray-900 dark:text-white font-semibold">{t('connectWallet')}</h3>
          <span className="ml-auto text-xs text-red-500 dark:text-red-400 font-medium">обязательно</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 ml-11">
          Кошелёк привязывается к вашей учётной записи и используется для входа в систему
        </p>
        {!connected ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {connecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Подключение...
              </>
            ) : (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {t('selectWallet')}
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">{t('connected')}</div>
              <div className="text-gray-500 dark:text-gray-400 font-mono text-xs truncate">{publicKey?.toBase58()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Privacy notice */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg width="16" height="16" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <div className="text-blue-600 dark:text-blue-400 font-medium text-sm mb-1">{t('privacy')}</div>
            <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
              {t('privacyText')}
            </p>
          </div>
        </div>
      </div>

      {/* Consent */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div
          onClick={() => setAgreed(!agreed)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
            agreed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600 group-hover:border-gray-400 dark:group-hover:border-gray-500'
          }`}
        >
          {agreed && (
            <svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t('agreeTerms')}
        </span>
      </label>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!isValidIIN || !isValidName || !isValidPhone || !district || !connected || !agreed || step === 'registering'}
        className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
          isValidIIN && isValidName && isValidPhone && district && connected && agreed
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
        }`}
      >
        {step === 'registering' ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {solanaLoading ? t('signingTx') : t('savingDb')}
          </>
        ) : (
          <>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {t('registerButton')}
          </>
        )}
      </button>
    </div>
  )
}
