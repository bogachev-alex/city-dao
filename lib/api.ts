const BASE = ''

// ─── Simple in-memory cache (TTL-based) ───

const cache = new Map<string, { data: any; expires: number }>()

async function cachedFetch(url: string, ttlMs: number): Promise<any> {
  const key = url
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expires > now) return hit.data
  const res = await fetch(url)
  const data = await res.json()
  cache.set(key, { data, expires: now + ttlMs })
  // Prevent unbounded growth
  if (cache.size > 100) {
    const firstKey = Array.from(cache.keys())[0]
    if (firstKey) cache.delete(firstKey)
  }
  return data
}

/** Invalidate cache entries matching a prefix (e.g. after mutation) */
export function invalidateCache(prefix: string) {
  Array.from(cache.keys()).forEach((key) => {
    if (key.includes(prefix)) cache.delete(key)
  })
}

// ─── Contracts ───

export async function fetchContracts(params?: {
  district?: string
  status?: string
  customer?: string
  subjectType?: string
  amountMin?: number
}) {
  const url = new URL('/api/contracts', window.location.origin)
  if (params?.district) url.searchParams.set('district', params.district)
  if (params?.status) url.searchParams.set('status', params.status)
  if (params?.customer) url.searchParams.set('customer', params.customer)
  if (params?.subjectType) url.searchParams.set('subjectType', params.subjectType)
  if (params?.amountMin != null && !Number.isNaN(params.amountMin)) {
    url.searchParams.set('amountMin', String(params.amountMin))
  }
  return cachedFetch(url.toString(), 60_000) // 1 min
}

export async function fetchContract(id: string) {
  return cachedFetch(`${BASE}/api/contracts/${id}`, 60_000)
}

export async function createContract(
  data: {
    title: string
    description?: string
    contractorName: string
    contractorId?: string
    totalAmount: number
    deadline: string
    district: string
    lat: number
    lng: number
    category?: string
    onChainPubkey?: string
    milestones: { description: string; deadlineDays: number; tranchePct: number }[]
  },
  authHeaders?: Record<string, string>
) {
  const res = await fetch(`${BASE}/api/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create contract')
  }
  return res.json()
}

// ─── Treasury ───

export async function fetchTreasury(district: string) {
  return cachedFetch(`${BASE}/api/treasury/${encodeURIComponent(district)}`, 120_000) // 2 min
}

export async function fetchTreasuries() {
  return cachedFetch(`${BASE}/api/treasury`, 120_000)
}

// ─── Citizens ───

export async function fetchCitizen(wallet: string) {
  return cachedFetch(`${BASE}/api/citizens?wallet=${wallet}`, 120_000) // 2 min
}

export async function registerCitizen(data: { walletAddress: string; district: string; iinHash: string }) {
  const res = await fetch(`${BASE}/api/citizens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

// ─── Jury ───

export async function fetchJurySession(sessionId: string) {
  const res = await fetch(`${BASE}/api/jury?sessionId=${sessionId}`)
  return res.json()
}

// ─── Work Logs ───

export async function fetchWorkLogs(contractId: string) {
  const res = await fetch(`${BASE}/api/work-logs?contractId=${contractId}`)
  return res.json()
}

// ─── Suggestions ───

export async function fetchSuggestions(params?: { district?: string; status?: string }) {
  const url = new URL('/api/suggestions', window.location.origin)
  if (params?.district) url.searchParams.set('district', params.district)
  if (params?.status) url.searchParams.set('status', params.status)
  const res = await fetch(url)
  return res.json()
}

// ─── Contractors ───

export async function fetchContractors() {
  const res = await fetch(`${BASE}/api/contractors`)
  return res.json()
}

// ─── Crowdfunding ───

export async function fetchCampaigns(params?: { district?: string; status?: string; category?: string }) {
  const url = new URL('/api/crowdfunding', window.location.origin)
  if (params?.district) url.searchParams.set('district', params.district)
  if (params?.status) url.searchParams.set('status', params.status)
  if (params?.category) url.searchParams.set('category', params.category)
  return cachedFetch(url.toString(), 60_000) // 1 min
}

export async function fetchCampaign(id: string) {
  return cachedFetch(`${BASE}/api/crowdfunding/${id}`, 60_000)
}

export async function createCampaign(data: {
  title: string
  description: string
  district: string
  category: string
  targetAmount: number
  deadline: string
  creatorId: string
  lat?: number
  lng?: number
  onChainPubkey?: string
}) {
  const res = await fetch(`${BASE}/api/crowdfunding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function contributeToCampaign(campaignId: string, data: {
  citizenId: string
  amount: number
  anonymous?: boolean
  txSignature?: string
}) {
  const res = await fetch(`${BASE}/api/crowdfunding/${campaignId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updateCampaignStatus(campaignId: string, action: string, extra?: Record<string, string>) {
  const res = await fetch(`${BASE}/api/crowdfunding/${campaignId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  })
  return res.json()
}

// ─── Research ───

export async function fetchResearch(proposal: { title: string; amount: number; category: string; district?: string }) {
  const res = await fetch(`${BASE}/api/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposal }),
  })
  return res.json()
}
