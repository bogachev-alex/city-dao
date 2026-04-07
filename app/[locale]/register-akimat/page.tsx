'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from '@/i18n/routing'
import { Link } from '@/i18n/routing'
import { useAuth } from '@/components/AuthContext'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import type { AuthUser } from '@/lib/auth'

export default function RegisterAkimatPage() {
  const { login, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { publicKey, connected, select, connect, wallets, wallet, connecting } = useWallet()

  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [walletError, setWalletError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'done'>('form')

  const pendingConnectRef = useRef(false)

  useEffect(() => {
    if (pendingConnectRef.current && wallet && !connected && !connecting) {
      pendingConnectRef.current = false
      connect().catch((e) => setWalletError(e?.message ?? 'Ошибка подключения'))
    }
  }, [wallet?.adapter.name, connected, connecting, connect])

  useEffect(() => {
    if (authLoading) return
    if (user && user.role === 'AKIMAT') {
      router.replace('/admin' as any)
    }
  }, [user, authLoading, router])

  const handleConnect = useCallback(() => {
    setWalletError(null)
    const isUsable = (state: WalletReadyState) =>
      state === WalletReadyState.Installed || state === WalletReadyState.Loadable
    const usableWallet = wallets.find((w) => isUsable(w.readyState))
    if (!usableWallet) {
      setWalletError('Не найден кошелёк Solana. Установите Phantom, Solflare, Backpack или другой совместимый кошелёк.')
      return
    }
    if (wallet?.adapter.name === usableWallet.adapter.name) {
      connect().catch((e) => setWalletError(e?.message ?? 'Ошибка подключения'))
      return
    }
    pendingConnectRef.current = true
    select(usableWallet.adapter.name)
  }, [wallets, wallet, select, connect])

  const handleSubmit = async () => {
    if (!name.trim() || !connected || !publicKey) return
    setSubmitting(true)
    setError(null)
    try {
      const authUser: AuthUser = {
        role: 'AKIMAT',
        id: publicKey.toBase58(),
        name: name.trim(),
      }
      localStorage.setItem('akimat_profile', JSON.stringify({
        name: name.trim(),
        department: department.trim(),
        walletAddress: publicKey.toBase58(),
      }))
      login(authUser)
      setStep('done')
    } catch {
      setError('Ошибка сети. Попробуйте ещё раз.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="40" height="40" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Представитель акимата</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-2">{name}</p>
          {department && <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">{department}</p>}
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
            Кошелёк: <span className="font-mono">{publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-6)}</span>
          </p>
          <Link
            href="/admin"
            className="px-6 py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
          >
            Перейти к регистрации контрактов
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-950">
      <div className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Представитель <span className="text-emerald-600 dark:text-emerald-400">акимата</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Регистрация для доступа к реестру контрактов и управлению
          </p>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
              <div className="text-2xl mb-1.5">📋</div>
              <div className="text-gray-900 dark:text-white text-xs font-semibold">Реестр</div>
              <div className="text-gray-400 dark:text-gray-500 text-xs">Регистрация контрактов</div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
              <div className="text-2xl mb-1.5">🔗</div>
              <div className="text-gray-900 dark:text-white text-xs font-semibold">Блокчейн</div>
              <div className="text-gray-400 dark:text-gray-500 text-xs">On-chain транзакции</div>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
              <div className="text-2xl mb-1.5">🏛️</div>
              <div className="text-gray-900 dark:text-white text-xs font-semibold">Казна</div>
              <div className="text-gray-400 dark:text-gray-500 text-xs">Управление районами</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">1</div>
            <h3 className="text-gray-900 dark:text-white font-semibold">Данные сотрудника</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-1.5 block">ФИО</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className={`w-full bg-gray-50 dark:bg-gray-950 border rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 transition-all text-sm ${
                  name.length > 0 && name.trim().length < 2
                    ? 'border-red-300 dark:border-red-500/50 focus:ring-red-200'
                    : name.trim().length >= 2
                    ? 'border-emerald-300 dark:border-emerald-500/50 focus:ring-emerald-200'
                    : 'border-gray-200 dark:border-gray-700 focus:ring-emerald-200'
                }`}
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-1.5 block">Отдел / управление (необязательно)</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Управление строительства"
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-500/30 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">2</div>
            <h3 className="text-gray-900 dark:text-white font-semibold">Кошелёк Solana</h3>
            <span className="ml-auto text-xs text-red-500 dark:text-red-400 font-medium">обязательно</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 ml-11">
            Кошелёк для подписания on-chain транзакций. Может совпадать с кошельком гражданина или подрядчика.
          </p>

          {walletError && (
            <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2 mb-3">
              <p>{walletError}</p>
            </div>
          )}

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
                  Подключить кошелёк
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
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">Кошелёк подключён</div>
                <div className="text-gray-500 dark:text-gray-400 font-mono text-xs truncate">{publicKey?.toBase58()}</div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !connected || submitting}
          className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
            name.trim() && connected
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Регистрация...
            </>
          ) : (
            <>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Войти как представитель акимата
            </>
          )}
        </button>

        <div className="text-center text-xs text-gray-400 dark:text-gray-500">
          <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
            Вернуться к входу
          </Link>
          {' · '}
          <Link href="/register" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
            Регистрация гражданина
          </Link>
          {' · '}
          <Link href="/register-contractor" className="text-amber-600 dark:text-amber-400 font-medium hover:underline">
            Регистрация подрядчика
          </Link>
        </div>
      </div>
    </div>
  )
}
