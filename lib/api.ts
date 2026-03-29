const BASE = ''

/**
 * Reads the current auth user from localStorage and returns HTTP headers
 * with x-user-role + Authorization: Bearer <token> for API mutation calls.
 * Returns empty object when called server-side or when not logged in.
 */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('amanat_auth')
    if (!raw) return {}
    const user = JSON.parse(raw) as { role?: string; id?: string }
    if (!user?.role) return {}
    const token = btoa(JSON.stringify({ role: user.role, id: user.id ?? '' }))
    return {
      'x-user-role': user.role,
      Authorization: `Bearer ${token}`,
    }
  } catch {
    return {}
  }
}

// ─── Contracts ───

export async function fetchContracts(params?: { district?: string; status?: string }) {
  const url = new URL('/api/contracts', window.location.origin)
  if (params?.district) url.searchParams.set('district', params.district)
  if (params?.status) url.searchParams.set('status', params.status)
  const res = await fetch(url)
  return res.json()
}

export async function fetchContract(id: string) {
  const res = await fetch(`${BASE}/api/contracts/${id}`)
  return res.json()
}

export async function createContract(data: {
  title: string
  description?: string
  contractorName: string
  totalAmount: number
  deadline: string
  district: string
  lat: number
  lng: number
  category?: string
  onChainPubkey?: string
  milestones: { description: string; deadlineDays: number; tranchePct: number }[]
}) {
  const res = await fetch(`${BASE}/api/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
  const res = await fetch(`${BASE}/api/treasury/${encodeURIComponent(district)}`)
  return res.json()
}

export async function fetchTreasuries() {
  const res = await fetch(`${BASE}/api/treasury`)
  return res.json()
}

export async function voteOnProposal(district: string, data: {
  proposalId: string
  citizenId: string
  inFavor: boolean
}) {
  const res = await fetch(`${BASE}/api/treasury/${encodeURIComponent(district)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  })
  return res.json()
}

// ─── Citizens ───

export async function fetchCitizen(wallet: string) {
  const res = await fetch(`${BASE}/api/citizens?wallet=${wallet}`)
  if (res.status === 404) return null
  return res.json()
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

export async function commitJuryVote(data: { sessionId: string; citizenId: string; commitHash: string }) {
  const res = await fetch(`${BASE}/api/jury`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function revealJuryVote(data: { sessionId: string; citizenId: string; vote: string; salt: string }) {
  const res = await fetch(`${BASE}/api/jury`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  })
  return res.json()
}

// ─── Work Logs ───

export async function fetchWorkLogs(contractId: string) {
  const res = await fetch(`${BASE}/api/work-logs?contractId=${contractId}`)
  return res.json()
}

export async function createWorkLog(data: {
  contractId: string
  contractorId: string
  type: string
  title: string
  description?: string
  completionPct?: number
  workersOnSite?: number
  equipmentCount?: number
  photoHashes?: string[]
  gpsLat?: number
  gpsLng?: number
}) {
  const res = await fetch(`${BASE}/api/work-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  })
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
  const res = await fetch(url)
  return res.json()
}

export async function fetchCampaign(id: string) {
  const res = await fetch(`${BASE}/api/crowdfunding/${id}`)
  return res.json()
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
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updateCampaignStatus(campaignId: string, action: string, extra?: Record<string, string>) {
  const res = await fetch(`${BASE}/api/crowdfunding/${campaignId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
