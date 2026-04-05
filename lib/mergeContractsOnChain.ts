import type { Connection } from '@solana/web3.js'
import type { Contract } from '@/lib/contracts'
import {
  resolveContractOnChainPubkey,
  formatContractTitleForDisplay,
} from '@/lib/contracts'
import { fetchAllContractsOnChain } from '@/lib/web3/onchain'

function normalizeText(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()"]/g, ' ')
    .replace(/\s+/g, ' ')
}

function tokenSet(v: string): Set<string> {
  return new Set(normalizeText(v).split(' ').filter((s) => s.length > 2))
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  a.forEach((t) => {
    if (b.has(t)) inter++
  })
  return inter / Math.max(a.size, b.size)
}

/**
 * Merge DB-backed contracts with live Solana registry data: update status/deadline/coords,
 * and append accounts that exist only on-chain (same logic as the contracts list page).
 */
export async function mergeContractsWithOnChain(
  baseContracts: Contract[],
  connection?: Connection
): Promise<Contract[]> {
  try {
    const onChain = await fetchAllContractsOnChain(connection)
    const byPda = new Map(onChain.map((c) => [c.id, c]))
    const dbByOnChainPubkey = new Map<string, Contract>()
    for (const c of baseContracts) {
      const pk = c.onChainPubkey || null
      if (pk) dbByOnChainPubkey.set(pk, c)
    }

    const mergedBase = baseContracts.map((c) => {
      if (c.onChainPubkey && byPda.has(c.onChainPubkey)) {
        const live = byPda.get(c.onChainPubkey)!
        return {
          ...c,
          title: c.title,
          onChainPubkey: c.onChainPubkey,
          contractor: c.contractor,
          amount_usdc: c.amount_usdc,
          deadline: live.deadline || c.deadline,
          status: live.status || c.status,
          lat: live.lat ?? c.lat,
          lng: live.lng ?? c.lng,
          escrow_amount: live.escrow_amount ?? c.escrow_amount,
          penalty_amount: live.penalty_amount ?? c.penalty_amount,
          days_overdue: live.days_overdue ?? c.days_overdue,
          milestones: live.milestones?.length ? live.milestones : c.milestones,
        }
      }

      let resolvedPubkey = resolveContractOnChainPubkey(c.id, c.onChainPubkey)
      if (!resolvedPubkey) {
        const title = normalizeText(c.title)
        const titleTokens = tokenSet(c.title)
        const district = normalizeText(c.district)
        const amount = Number(c.amount_usdc || 0)

        let best: { id: string; score: number } | null = null
        for (const chainItem of onChain) {
          const cDistrict = normalizeText(chainItem.district)
          const cAmount = Number(chainItem.amount_usdc || 0)
          const cTitle = normalizeText(chainItem.title)
          const cTokens = tokenSet(chainItem.title)

          const districtScore = cDistrict === district ? 1 : 0
          const textScore =
            cTitle === title
              ? 1
              : cTitle.includes(title) || title.includes(cTitle)
                ? 0.85
                : overlapScore(titleTokens, cTokens)

          let amountScore = 0
          if (amount > 0 && cAmount > 0) {
            const rel = Math.abs(cAmount - amount) / Math.max(amount, cAmount)
            if (rel <= 0.01) amountScore = 1
            else if (rel <= 0.05) amountScore = 0.7
            else if (rel <= 0.15) amountScore = 0.35
          }

          const score = districtScore * 0.35 + textScore * 0.5 + amountScore * 0.15
          if (!best || score > best.score) best = { id: chainItem.id, score }
        }
        if (best && best.score >= 0.72) {
          resolvedPubkey = best.id
        } else {
          const districtCandidates = onChain.filter((x) => normalizeText(x.district) === district)
          let softBest: { id: string; score: number } | null = null
          for (const chainItem of districtCandidates) {
            const cTitle = normalizeText(chainItem.title)
            const cTokens = tokenSet(chainItem.title)
            const cAmount = Number(chainItem.amount_usdc || 0)
            const textScore =
              cTitle === title
                ? 1
                : cTitle.includes(title) || title.includes(cTitle)
                  ? 0.8
                  : overlapScore(titleTokens, cTokens)
            let amountScore = 0
            if (amount > 0 && cAmount > 0) {
              const rel = Math.abs(cAmount - amount) / Math.max(amount, cAmount)
              if (rel <= 0.1) amountScore = 1
              else if (rel <= 0.3) amountScore = 0.6
              else if (rel <= 0.6) amountScore = 0.3
            }
            const score = textScore * 0.8 + amountScore * 0.2
            if (!softBest || score > softBest.score) softBest = { id: chainItem.id, score }
          }
          if (softBest && (softBest.score >= 0.55 || districtCandidates.length === 1)) {
            resolvedPubkey = softBest.id
          }
        }
      }
      if (!resolvedPubkey) return c
      const live = byPda.get(resolvedPubkey)
      if (!live) return c
      return {
        ...c,
        title: c.title,
        onChainPubkey: resolvedPubkey,
        contractor: c.contractor,
        amount_usdc: c.amount_usdc,
        deadline: live.deadline || c.deadline,
        status: live.status || c.status,
        lat: live.lat ?? c.lat,
        lng: live.lng ?? c.lng,
        escrow_amount: live.escrow_amount ?? c.escrow_amount,
        penalty_amount: live.penalty_amount ?? c.penalty_amount,
        days_overdue: live.days_overdue ?? c.days_overdue,
        milestones: live.milestones?.length ? live.milestones : c.milestones,
      }
    })

    const knownPubkeys = new Set(
      mergedBase
        .map((c) => resolveContractOnChainPubkey(c.id, c.onChainPubkey))
        .filter(Boolean) as string[]
    )
    const onChainOnly = onChain
      .filter((c) => !knownPubkeys.has(c.id))
      .map((c) => {
        const db = dbByOnChainPubkey.get(c.id)
        if (db) {
          return {
            ...c,
            id: db.id,
            title: db.title,
            contractor: db.contractor,
            customerName: db.customerName,
            registryNumber: db.registryNumber,
            subjectType: db.subjectType,
            onChainPubkey: c.id,
          }
        }
        return {
          ...c,
          title: formatContractTitleForDisplay(c.title),
        }
      })

    const combined = [...onChainOnly, ...mergedBase]
    const seen = new Set<string>()
    return combined.filter((c) => {
      const key = c.onChainPubkey || c.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch {
    return baseContracts
  }
}
