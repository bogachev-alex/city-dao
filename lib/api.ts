const BASE = ''

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

// ─── Treasury ───

export async function fetchTreasury(district: string) {
  const res = await fetch(`${BASE}/api/treasury/${encodeURIComponent(district)}`)
  return res.json()
}

export async function fetchTreasuries() {
  const res = await fetch(`${BASE}/api/treasury`)
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

// ─── Research ───

export async function fetchResearch(proposal: { title: string; amount: number; category: string; district?: string }) {
  const res = await fetch(`${BASE}/api/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposal }),
  })
  return res.json()
}
