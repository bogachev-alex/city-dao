'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useAuth } from './AuthContext'
import { DemoWalletName } from '@/lib/web3/DemoKeypairAdapter'

/**
 * Floating banner shown when the demo wallet (DemoKeypairAdapter) is active.
 * Displays:
 *  - wallet address (truncated / expandable)
 *  - devnet SOL balance
 *  - "Request SOL" button if balance is low
 *  - Solana Explorer link
 *
 * Auto-requests an airdrop on first connection.
 */
export function DemoWalletBanner() {
  const { user } = useAuth()
  const { publicKey, connected, wallet } = useWallet()
  const { connection } = useConnection()

  const [balance, setBalance] = useState<number | null>(null)
  const [airdropping, setAirdropping] = useState(false)
  const [airdropMsg, setAirdropMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [autoAirdropDone, setAutoAirdropDone] = useState(false)

  const isDemoWallet =
    connected && wallet?.adapter.name === DemoWalletName && !!publicKey

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return
    try {
      const b = await connection.getBalance(publicKey)
      setBalance(b / LAMPORTS_PER_SOL)
    } catch {}
  }, [publicKey, connection])

  const requestAirdrop = useCallback(async () => {
    if (!publicKey) return
    setAirdropping(true)
    setAirdropMsg(null)
    try {
      const res = await fetch('/api/solana/airdrop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: publicKey.toBase58() }),
      })
      const data = await res.json()
      if (data.error) {
        setAirdropMsg(data.error)
      } else if (data.skipped) {
        setAirdropMsg('Баланс уже достаточный')
        setBalance(data.balance)
      } else {
        setAirdropMsg('2 SOL запрошены — подождите ~5 сек')
        // Poll balance after a short delay
        setTimeout(fetchBalance, 5000)
        setTimeout(fetchBalance, 12000)
      }
    } catch (e: any) {
      setAirdropMsg(e?.message ?? 'Ошибка')
    } finally {
      setAirdropping(false)
    }
  }, [publicKey, fetchBalance])

  // Fetch balance on connect + auto-airdrop once
  useEffect(() => {
    if (!isDemoWallet) return
    fetchBalance()
    if (!autoAirdropDone) {
      setAutoAirdropDone(true)
      requestAirdrop()
    }
  }, [isDemoWallet, fetchBalance, requestAirdrop, autoAirdropDone])

  // Refresh balance every 30s
  useEffect(() => {
    if (!isDemoWallet) return
    const id = setInterval(fetchBalance, 30_000)
    return () => clearInterval(id)
  }, [isDemoWallet, fetchBalance])

  if (!user || !isDemoWallet || dismissed) return null

  const addr = publicKey.toBase58()
  const lowBalance = balance !== null && balance < 0.1

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40 pointer-events-none">
      <div className="bg-gray-950 border border-emerald-500/40 rounded-xl p-3 shadow-2xl shadow-emerald-500/10 pointer-events-auto">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-xs font-semibold text-emerald-400 flex-1">
            Demo Wallet · Devnet
          </span>
          <span className="text-xs text-gray-400 font-mono">
            {balance === null ? (
              <span className="opacity-50">…</span>
            ) : (
              <span className={lowBalance ? 'text-yellow-400' : 'text-white'}>
                {balance.toFixed(3)} SOL
              </span>
            )}
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-600 hover:text-gray-300 transition-colors ml-1 text-xs"
          >
            ✕
          </button>
        </div>

        {/* Address */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left text-xs text-gray-500 font-mono hover:text-gray-300 transition-colors mb-2 break-all"
        >
          {expanded ? addr : `${addr.slice(0, 10)}…${addr.slice(-10)}`}
        </button>

        {/* Low balance warning + airdrop button */}
        {lowBalance && (
          <button
            onClick={requestAirdrop}
            disabled={airdropping}
            className="w-full text-xs py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 mb-2"
          >
            {airdropping ? 'Запрашиваем SOL…' : '+ Запросить 2 тестовых SOL'}
          </button>
        )}

        {airdropMsg && (
          <p className="text-xs text-gray-400 mb-1.5">{airdropMsg}</p>
        )}

        {/* Footer links */}
        <div className="flex items-center gap-3 text-xs">
          <a
            href={`https://explorer.solana.com/address/${addr}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Explorer ↗
          </a>
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            Faucet ↗
          </a>
          <span className="ml-auto text-gray-700 text-xs">
            Это devnet — не реальные деньги
          </span>
        </div>
      </div>
    </div>
  )
}
