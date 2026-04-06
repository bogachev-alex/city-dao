'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { Link } from '@/i18n/routing'
import { useAuth } from '@/components/AuthContext'
import { generateSalt, hashVoteCommitment } from '@/lib/crypto'
import { awardTokens } from '@/lib/tokens'
import { getSolanaExplorerTxUrl, isSolanaAddress } from '@/lib/blockchainDashboardModel'
import { useJuryMechanism } from '@/lib/web3/useJuryMechanism'

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Try to parse a base58 Solana public key; return null if invalid. */
function tryParsePublicKey(s: string): PublicKey | null {
  try {
    return new PublicKey(s)
  } catch {
    return null
  }
}

interface JuryVotingProps {
  sessionId: string
}

type Phase = 'loading' | 'commit' | 'reveal' | 'results' | 'error'

interface JurySessionData {
  id: string
  status: string
  contract: { id: string; title: string; district: string; onChainPubkey?: string | null }
  milestone: { id: string; description: string }
  milestoneIndexOnChain?: number
  evidencePhotoUrls?: string[]
  commitDeadline: string | null
  revealDeadline: string | null
  weightedAccept: number
  weightedReject: number
  result: string | null
  votes: {
    id: string
    citizenId: string
    isExpert: boolean
    weight: number
    commitHash: string | null
    revealedVote: string | null
    citizen: { id: string; walletAddress: string; tier: string }
  }[]
}

export default function JuryVoting({ sessionId }: JuryVotingProps) {
  const t = useTranslations('components.juryVoting')
  const { user, authHeader } = useAuth()
  const { publicKey: walletPubkey } = useWallet()
  const { commitVote: commitOnChain, revealVote: revealOnChain } = useJuryMechanism()
  const [session, setSession] = useState<JurySessionData | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [vote, setVote] = useState<'accept' | 'reject' | null>(null)
  const [commitHash, setCommitHash] = useState<string | null>(null)
  const [salt, setSalt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [demoMode, setDemoMode] = useState(false)
  const [onChainTx, setOnChainTx] = useState<string | null>(null)

  const resolvedWallet = walletPubkey?.toBase58() || (user?.id && isSolanaAddress(user.id) ? user.id : null)

  const jurorKey = useMemo(() => {
    if (demoMode) return 'demo'
    return resolvedWallet || 'anon'
  }, [demoMode, resolvedWallet])

  const storageKey = `jury_salt_${sessionId}_${jurorKey}`

  const myVote = useMemo(() => {
    if (!session?.votes?.length) return undefined
    if (demoMode) return session.votes[0]
    if (!resolvedWallet) return undefined
    return session.votes.find((v) => v.citizen.walletAddress === resolvedWallet)
  }, [session, demoMode, resolvedWallet])

  const PHOTO_PLACEHOLDERS = [
    { label: t('photo1'), color: 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700' },
    { label: t('photo2'), color: 'from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700' },
    { label: t('photo3'), color: 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700' },
  ]


  const initDemoSession = () => {
    setDemoMode(true)
    const demoSession: JurySessionData = {
      id: sessionId,
      status: 'COMMIT_PHASE',
      contract: { id: '1', title: 'Ремонт тротуара, набережная Весновки', district: 'Медеуский', onChainPubkey: null },
      milestone: { id: '1-2', description: 'Укладка основания' },
      milestoneIndexOnChain: 0,
      evidencePhotoUrls: [],
      commitDeadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      revealDeadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      weightedAccept: 0,
      weightedReject: 0,
      result: null,
      votes: [
        { id: 'v1', citizenId: 'demo-citizen', isExpert: false, weight: 1, commitHash: null, revealedVote: null, citizen: { id: 'demo-citizen', walletAddress: 'Demo...Wallet', tier: 'ACTIVE' } },
        { id: 'v2', citizenId: 'c2', isExpert: true, weight: 2, commitHash: 'abc123', revealedVote: null, citizen: { id: 'c2', walletAddress: '7xKq...9fPm', tier: 'TRUSTED' } },
        { id: 'v3', citizenId: 'c3', isExpert: false, weight: 1, commitHash: 'def456', revealedVote: null, citizen: { id: 'c3', walletAddress: '3mRt...2wNx', tier: 'ACTIVE' } },
      ],
    }
    setSession(demoSession)
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const d = JSON.parse(stored)
      setSalt(d.salt)
      setVote(d.vote)
      setCommitHash(d.hash)
      setPhase('reveal')
    } else {
      setPhase('commit')
    }
    setTimeLeft(24 * 3600)
  }

  useEffect(() => {
    if (sessionId === 'demo' || sessionId.startsWith('demo-')) {
      initDemoSession()
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/jury?sessionId=${encodeURIComponent(sessionId)}`)
        const data = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok || data.error) {
          const notFound = r.status === 404 || data.error === 'Session not found'
          setError(notFound ? t('sessionNotStarted') : typeof data.error === 'string' ? data.error : t('loadError'))
          setPhase('error')
          return
        }
        setSession(data)

        if (data.status === 'FINALIZED' || data.status === 'ESCALATED') {
          setPhase('results')
        } else if (data.status === 'REVEAL_PHASE') {
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const d = JSON.parse(stored)
            setSalt(d.salt)
            setVote(d.vote)
            setCommitHash(d.hash)
          }
          setPhase('reveal')
          if (data.revealDeadline) {
            setTimeLeft(Math.max(0, Math.floor((new Date(data.revealDeadline).getTime() - Date.now()) / 1000)))
          }
        } else {
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const d = JSON.parse(stored)
            setSalt(d.salt)
            setVote(d.vote)
            setCommitHash(d.hash)
            setPhase('reveal')
          } else {
            setPhase('commit')
          }
          if (data.commitDeadline) {
            setTimeLeft(Math.max(0, Math.floor((new Date(data.commitDeadline).getTime() - Date.now()) / 1000)))
          }
        }
      } catch {
        if (!cancelled) {
          setError(t('loadError'))
          setPhase('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId, storageKey, t])

  useEffect(() => {
    if (phase === 'results' || phase === 'loading' || phase === 'error') return
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [phase])

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleCommit = async () => {
    if (!vote || !session) return
    setLoading(true)
    setOnChainTx(null)

    try {
      const newSalt = generateSalt()
      const hash = await hashVoteCommitment(vote, newSalt)

      if (!demoMode) {
        const res = await fetch('/api/jury', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({
            sessionId: session.id,
            commitHash: hash,
          }),
        })
        const result = await res.json()
        if (result.error) {
          setError(result.error)
          setLoading(false)
          return
        }
      }

      if (walletPubkey) {
        const pkStr = session.contract.onChainPubkey
        const contractPubkey = pkStr ? tryParsePublicKey(pkStr) : null
        const milestoneIndex = typeof session.milestoneIndexOnChain === 'number' ? session.milestoneIndexOnChain : 0
        if (contractPubkey) {
          try {
            const { tx } = await commitOnChain(contractPubkey, milestoneIndex, hexToBytes(hash))
            setOnChainTx(tx)
          } catch (onChainErr) {
            console.warn('On-chain commitVote failed:', onChainErr)
          }
        }
      }

      localStorage.setItem(storageKey, JSON.stringify({ salt: newSalt, vote, hash }))
      setSalt(newSalt)
      setCommitHash(hash)
      awardTokens('jury_vote')
      if (walletPubkey) {
        fetch('/api/tokens/award', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'jury_vote', walletAddress: walletPubkey.toBase58() }),
        }).catch(() => {})
      }
      setPhase('reveal')
      if (session.revealDeadline) {
        setTimeLeft(Math.max(0, Math.floor((new Date(session.revealDeadline).getTime() - Date.now()) / 1000)))
      } else {
        setTimeLeft(24 * 3600)
      }
    } catch {
      setError(t('voteError'))
    } finally {
      setLoading(false)
    }
  }

  const handleReveal = async () => {
    if (!vote || !salt || !session) return
    setLoading(true)
    setOnChainTx(null)

    try {
      if (!demoMode) {
        const res = await fetch('/api/jury', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({
            sessionId: session.id,
            vote,
            salt,
          }),
        })
        const result = await res.json()
        if (result.error) {
          setError(result.error)
          setLoading(false)
          return
        }
        const updated = await fetch(`/api/jury?sessionId=${sessionId}`).then((r) => r.json())
        setSession(updated)
      } else {
        // Demo mode: simulate results
        setSession((prev) => prev ? {
          ...prev,
          status: 'FINALIZED',
          result: vote === 'accept' ? 'ACCEPT' : 'REJECT',
          weightedAccept: vote === 'accept' ? 3 : 1,
          weightedReject: vote === 'reject' ? 3 : 1,
          votes: prev.votes.map((v, i) => ({
            ...v,
            commitHash: v.commitHash || 'demo',
            revealedVote: i === 0 ? vote!.toUpperCase() : (i === 1 ? 'ACCEPT' : 'REJECT'),
          })),
        } : prev)
      }

      if (walletPubkey) {
        const pkStr = session.contract.onChainPubkey
        const contractPubkey = pkStr ? tryParsePublicKey(pkStr) : null
        const milestoneIndex = typeof session.milestoneIndexOnChain === 'number' ? session.milestoneIndexOnChain : 0
        if (contractPubkey) {
          try {
            const { tx } = await revealOnChain(contractPubkey, milestoneIndex, vote, hexToBytes(salt))
            setOnChainTx(tx)
          } catch (onChainErr) {
            console.warn('On-chain revealVote failed:', onChainErr)
          }
        }
      }

      localStorage.removeItem(storageKey)
      awardTokens('jury_reveal')
      if (walletPubkey) {
        fetch('/api/tokens/award', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'jury_reveal', walletAddress: walletPubkey.toBase58() }),
        }).catch(() => {})
      }
      setPhase('results')
    } catch {
      setError(t('revealError'))
    } finally {
      setLoading(false)
    }
  }

  const totalWeight = session ? session.votes.reduce((sum, v) => sum + v.weight, 0) : 0
  const acceptWeight = session?.weightedAccept || 0
  const rejectWeight = session?.weightedReject || 0
  const acceptPct = totalWeight > 0 ? Math.round((acceptWeight / totalWeight) * 100) : 0
  const rejectPct = totalWeight > 0 ? 100 - acceptPct : 0
  const committed = session?.votes.filter((v) => v.commitHash).length || 0
  const revealed = session?.votes.filter((v) => v.revealedVote).length || 0
  const totalVoters = session?.votes.length || 0

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (session && !demoMode && phase !== 'results') {
    if (!resolvedWallet) {
      return (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">{t('notJurorWalletTitle')}</h2>
          <p className="text-sm text-amber-800 dark:text-amber-300/90 mb-4">{t('notJurorWalletLead')}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            {t('openLogin')}
          </Link>
        </div>
      )
    }
    if (session.status === 'REVEAL_PHASE' && !myVote) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      if (!stored) {
        return (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">{t('missedCommitTitle')}</h2>
            <p className="text-sm text-amber-800 dark:text-amber-300/90">{t('missedCommitLead')}</p>
          </div>
        )
      }
    }
  }

  if (phase === 'error') {
    const parts = sessionId.split('-').filter(Boolean)
    const contractHref = parts.length >= 1 && parts[0] !== 'demo' ? `/contracts/${encodeURIComponent(parts[0])}` : null
    return (
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 text-amber-900 dark:text-amber-200 text-sm space-y-4">
        <p>{error || t('unknownError')}</p>
        {contractHref && (
          <Link
            href={contractHref}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            {t('backToContract')}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Session info */}
      {session && (
        <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="text-gray-700 dark:text-gray-300">{session.contract.title}</span> → {session.milestone.description}
          <span className="ml-2">•</span>
          <span className="ml-2">{committed}/{totalVoters} {t('commits')}</span>
          <span className="ml-1">•</span>
          <span className="ml-1">{revealed}/{totalVoters} {t('revealed')}</span>
        </div>
      )}

      {/* Phase indicator */}
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        {(['commit', 'reveal', 'results'] as const).map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              phase === p
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                : (phase === 'results' || (phase === 'reveal' && p === 'commit'))
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-gray-400 dark:text-gray-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                phase === p ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
              }`}>{i + 1}</span>
              {p === 'commit' ? t('votingPhase') : p === 'reveal' ? t('revealPhase') : t('resultsPhase')}
            </div>
            {i < 2 && <div className="w-4 h-0.5 bg-gray-200" />}
          </div>
        ))}
        <div className="ml-auto">
          {phase !== 'results' && timeLeft > 0 && (
            <div className={`text-sm font-mono font-medium px-3 py-1.5 rounded-lg border ${
              timeLeft < 60 ? 'text-red-500 dark:text-red-400 border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 animate-pulse' : 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950'
            }`}>
              {formatTime(timeLeft)}
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* On-chain TX confirmation */}
      {onChainTx && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>On-chain TX: </span>
          <a
            href={getSolanaExplorerTxUrl(onChainTx)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono underline hover:text-emerald-600"
          >
            {onChainTx.slice(0, 8)}…{onChainTx.slice(-8)}
          </a>
        </div>
      )}

      {/* COMMIT PHASE */}
      {phase === 'commit' && session && (
        <div className="space-y-5">
          {!demoMode && (
            <div className="space-y-2">
              <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-lg p-3 text-xs text-sky-800 dark:text-sky-200">
                {t('commitRevealHint')}
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
                {t('oneVoteTestNote')}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold mb-3">{t('contractorPhotos')}</h3>
            <div className="grid grid-cols-3 gap-3">
              {session.evidencePhotoUrls && session.evidencePhotoUrls.length > 0 ? (
                session.evidencePhotoUrls.map((url, i) => (
                  <a
                    key={`${url}-${i}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors block bg-gray-100 dark:bg-gray-900"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </a>
                ))
              ) : (
                PHOTO_PLACEHOLDERS.map((photo, i) => (
                  <div key={i} className={`aspect-video rounded-xl bg-gradient-to-br ${photo.color} border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors group`}>
                    <svg width="24" height="24" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:stroke-emerald-500 transition-colors">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:text-gray-400 transition-colors">{photo.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold mb-3">{t('yourVote')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setVote('accept')} className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                vote === 'accept' ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-500/20 shadow-md' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-green-300 dark:hover:border-green-500/40'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${vote === 'accept' ? 'bg-green-500' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <svg width="24" height="24" fill="none" stroke={vote === 'accept' ? 'white' : '#9ca3af'} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <div className={`font-semibold ${vote === 'accept' ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>{t('accept')}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{t('workDone')}</div>
                </div>
              </button>
              <button onClick={() => setVote('reject')} className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                vote === 'reject' ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-500/10 shadow-md' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-red-300 dark:hover:border-red-500/40'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${vote === 'reject' ? 'bg-red-500' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <svg width="24" height="24" fill="none" stroke={vote === 'reject' ? 'white' : '#9ca3af'} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <div>
                  <div className={`font-semibold ${vote === 'reject' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{t('reject')}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{t('needsRevision')}</div>
                </div>
              </button>
            </div>
          </div>

          <button onClick={handleCommit} disabled={!vote || loading} className={`w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
            vote ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('sendingToDb')}</>
            ) : (
              <><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>{t('commitVote')}</>
            )}
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            {t('commitExplanation')}
          </p>
        </div>
      )}

      {/* REVEAL PHASE */}
      {phase === 'reveal' && (
        <div className="space-y-5">
          {!demoMode && (
            <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-lg p-3 text-xs text-sky-800 dark:text-sky-200">
              {t('commitRevealHint')}
            </div>
          )}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4">{t('yourCommittedVote')}</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('voteLabel')}</div>
                <div className={`font-medium ${vote === 'accept' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {vote === 'accept' ? t('acceptUpper') : t('rejectUpper')}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('commitHash')}</div>
                <div className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all bg-gray-50 dark:bg-gray-950 p-2 rounded border border-gray-200 dark:border-gray-800">
                  {commitHash}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-700">
            <div className="flex items-start gap-2">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('jurorsCommitted', { committed, total: totalVoters })}
            </div>
          </div>

          <button onClick={handleReveal} disabled={loading} className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md transition-all flex items-center justify-center gap-2">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('revealingVote')}</>
            ) : (
              <><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>{t('revealVote')}</>
            )}
          </button>
        </div>
      )}

      {/* RESULTS PHASE */}
      {phase === 'results' && (
        <div className="space-y-5">
          <div className="text-center py-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
              session?.result === 'ACCEPT' ? 'bg-emerald-50 dark:bg-emerald-500/20' : session?.result === 'REJECT' ? 'bg-red-50 dark:bg-red-500/10' : 'bg-yellow-50 dark:bg-yellow-500/20'
            }`}>
              <svg width="32" height="32" fill="none" stroke={session?.result === 'ACCEPT' ? '#10b981' : session?.result === 'REJECT' ? '#ef4444' : '#eab308'} strokeWidth="2" viewBox="0 0 24 24">
                {session?.result === 'ACCEPT'
                  ? <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  : session?.result === 'REJECT'
                  ? <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  : <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              </svg>
            </div>
            <h3 className="text-gray-900 dark:text-white font-bold text-xl mb-1">
              {session?.status === 'ESCALATED' ? t('tieEscalation') : t('votingFinished')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {session?.result === 'ACCEPT' ? t('stageAccepted') : session?.result === 'REJECT' ? t('stageRejected') : t('noDecision')}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <h4 className="text-gray-500 dark:text-gray-400 text-sm mb-4">{t('weightedDistribution')}</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-green-600 dark:text-green-400 font-medium">{t('accepted')}</span>
                  <span className="text-gray-900 dark:text-white font-bold">{acceptWeight} / {totalWeight}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${acceptPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-red-500 dark:text-red-400 font-medium">{t('rejected')}</span>
                  <span className="text-gray-900 dark:text-white font-bold">{rejectWeight} / {totalWeight}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${rejectPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Individual votes */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <h4 className="text-gray-500 dark:text-gray-400 text-sm mb-3">{t('jurorVotes')}</h4>
            <div className="space-y-2">
              {session?.votes.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${v.isExpert ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      {v.isExpert ? t('expert') : t('citizen')}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{v.citizen.walletAddress.slice(0, 12)}...</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs">x{v.weight}</span>
                  </div>
                  <span className={`font-medium ${
                    v.revealedVote === 'ACCEPT' ? 'text-emerald-600 dark:text-emerald-400' : v.revealedVote === 'REJECT' ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {v.revealedVote === 'ACCEPT' ? t('acceptedVerb') : v.revealedVote === 'REJECT' ? t('rejectedVerb') : v.commitHash ? t('hidden') : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
