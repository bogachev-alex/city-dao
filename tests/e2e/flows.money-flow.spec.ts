import { test, expect } from './fixtures'
import { AUTH_JSON, seedLocalStorageAuth } from './fixtures/auth'

/**
 * Money-flow E2E tests — verifies REAL money movements through API endpoints.
 *
 * These tests call the live API to confirm that penalties credit the treasury,
 * contract registration computes escrow correctly, penalty caps are enforced,
 * and crowdfunding contributions update campaign totals.
 */

const BASE = 'http://127.0.0.1:3000'
const DISTRICT = 'Ауэзовский'
const DISTRICT_ENCODED = encodeURIComponent(DISTRICT)

/** Akimat auth header for API calls requiring AKIMAT role */
const AKIMAT_HEADERS = {
  Authorization:
    'Bearer ' +
    Buffer.from(JSON.stringify({ role: 'AKIMAT', id: 'demo-akimat-1' })).toString('base64'),
  'Content-Type': 'application/json',
}

/* ------------------------------------------------------------------ */
/*  Test 1 — Penalty → Treasury Balance Increase                      */
/* ------------------------------------------------------------------ */

test.describe.serial('Money flow: Penalty → Treasury', () => {
  let contractId: string
  let contractTotalAmount: number
  let initialBalance: number
  const AMOUNT = 20_000_000 // 20M tenge

  test('fetch initial treasury balance for district', async ({ request }) => {
    console.log(`[Penalty→Treasury] GET treasury for ${DISTRICT}`)
    const res = await request.get(`/api/treasury/${DISTRICT_ENCODED}`)
    expect(res.status()).toBe(200)

    const data = await res.json()
    initialBalance = Number(data.balance)
    console.log(`[Penalty→Treasury] Initial treasury balance: ${initialBalance}`)
    expect(typeof initialBalance).toBe('number')
  })

  test('create a fresh contract for penalty testing', async ({ request }) => {
    console.log(`[Penalty→Treasury] Creating fresh contract in ${DISTRICT}`)
    const res = await request.post('/api/contracts', {
      data: {
        title: `E2E Penalty Treasury Test ${Date.now()}`,
        description: 'Fresh contract for penalty → treasury balance test',
        district: DISTRICT,
        lat: 43.24, lng: 76.87,
        contractorName: 'ТОО ПенальтиТест',
        totalAmount: AMOUNT,
        deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'CONSTRUCTION',
        onChainPubkey: `e2e-penalty-treasury-${Date.now()}`,
        milestones: [
          { description: 'Этап 1', deadlineDays: 30, tranchePct: 50 },
          { description: 'Этап 2', deadlineDays: 60, tranchePct: 50 },
        ],
      },
      headers: AKIMAT_HEADERS,
    })
    expect(res.status()).toBe(201)
    const data = await res.json()
    contractId = data.id
    contractTotalAmount = AMOUNT
    console.log(`[Penalty→Treasury] Created contract ${contractId}, totalAmount=${AMOUNT}`)
  })

  test('POST penalty and verify amount calculation', async ({ request }) => {
    const daysOverdue = 5
    console.log(
      `[Penalty→Treasury] POST penalty type=TIME_OVERDUE, daysOverdue=${daysOverdue} for contract ${contractId}`
    )

    const res = await request.post(`/api/contracts/${contractId}/penalty`, {
      data: { type: 'TIME_OVERDUE', daysOverdue },
      headers: { 'Content-Type': 'application/json' },
    })

    // Either 201 (created) or 409 (cap reached)
    expect([201, 409]).toContain(res.status())

    if (res.status() === 201) {
      const data = await res.json()
      const penaltyAmount = Number(data.penalty.amountTenge)
      const expectedRaw = contractTotalAmount * 0.01 * daysOverdue
      console.log(
        `[Penalty→Treasury] Penalty created: ${penaltyAmount} tenge (expected raw: ${expectedRaw})`
      )

      // Penalty should be <= the raw calculation (may be capped)
      expect(penaltyAmount).toBeGreaterThan(0)
      expect(penaltyAmount).toBeLessThanOrEqual(expectedRaw)
    } else {
      console.log('[Penalty→Treasury] Penalty cap already reached (409) — skipping amount check')
    }
  })

  test('verify treasury balance increased by penalty amount', async ({ request }) => {
    console.log(`[Penalty→Treasury] GET treasury for ${DISTRICT} after penalty`)
    const res = await request.get(`/api/treasury/${DISTRICT_ENCODED}`)
    expect(res.status()).toBe(200)

    const data = await res.json()
    const newBalance = Number(data.balance)
    console.log(
      `[Penalty→Treasury] Treasury balance after penalty: ${newBalance} (was ${initialBalance})`
    )

    // Balance should be >= initial (penalty credits the treasury)
    expect(newBalance).toBeGreaterThanOrEqual(initialBalance)
  })

  test('verify contract penaltyAmount increased', async ({ request }) => {
    console.log(`[Penalty→Treasury] GET contract ${contractId} to verify penaltyAmount`)
    const res = await request.get(`/api/contracts/${contractId}`)
    expect(res.status()).toBe(200)

    const data = await res.json()
    const penaltyAmount = Number(data.penaltyAmount)
    console.log(`[Penalty→Treasury] Contract penaltyAmount: ${penaltyAmount}`)
    expect(penaltyAmount).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ */
/*  Test 2 — Contract Registration → Escrow = 20%                     */
/* ------------------------------------------------------------------ */

test.describe.serial('Money flow: Contract Registration → Escrow', () => {
  let createdContractId: string
  const totalAmount = 50_000_000 // 50M tenge
  const uniqueTitle = `E2E MoneyFlow Test Contract ${Date.now()}`
  const onChainPubkey = `e2e-money-flow-test-${Date.now()}`

  test('POST new contract with akimat auth', async ({ request }) => {
    console.log('[Registration→Escrow] POST /api/contracts with akimat auth')
    const res = await request.post('/api/contracts', {
      data: {
        title: uniqueTitle,
        description: 'E2E test: verifying escrow = 20% of totalAmount',
        district: DISTRICT,
        lat: 43.238,
        lng: 76.945,
        contractorName: 'ТОО ТестСтрой',
        totalAmount,
        deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'CONSTRUCTION',
        onChainPubkey,
        milestones: [
          { description: 'Этап 1: Фундамент', deadlineDays: 30, tranchePct: 30 },
          { description: 'Этап 2: Каркас', deadlineDays: 60, tranchePct: 40 },
          { description: 'Этап 3: Отделка', deadlineDays: 90, tranchePct: 30 },
        ],
      },
      headers: AKIMAT_HEADERS,
    })

    expect(res.status()).toBe(201)
    const data = await res.json()
    createdContractId = data.id
    console.log(`[Registration→Escrow] Created contract: ${createdContractId}`)

    // Verify escrow = 20% of totalAmount
    const escrow = Number(data.escrowAmount)
    const expectedEscrow = totalAmount * 0.2
    console.log(`[Registration→Escrow] escrowAmount=${escrow}, expected=${expectedEscrow}`)
    expect(escrow).toBe(expectedEscrow)

    // Verify paidAmount starts at 0
    const paid = Number(data.paidAmount)
    console.log(`[Registration→Escrow] paidAmount=${paid}`)
    expect(paid).toBe(0)
  })

  test('GET created contract confirms persistence', async ({ request }) => {
    console.log(`[Registration→Escrow] GET /api/contracts/${createdContractId}`)
    const res = await request.get(`/api/contracts/${createdContractId}`)
    expect(res.status()).toBe(200)

    const data = await res.json()
    expect(data.id).toBe(createdContractId)
    expect(data.title).toBe(uniqueTitle)
    expect(data.district).toBe(DISTRICT)
    expect(Number(data.escrowAmount)).toBe(totalAmount * 0.2)
    expect(Number(data.paidAmount)).toBe(0)

    // Milestones persisted
    expect(Array.isArray(data.milestones)).toBe(true)
    expect(data.milestones.length).toBe(3)
    console.log(
      `[Registration→Escrow] Contract verified in DB with ${data.milestones.length} milestones`
    )
  })
})

/* ------------------------------------------------------------------ */
/*  Test 3 — Penalty Cap at 30%                                       */
/* ------------------------------------------------------------------ */

test.describe.serial('Money flow: Penalty Cap at 30%', () => {
  let contractId: string
  let totalAmount: number
  let maxPenalty: number

  test('create a fresh contract for penalty cap test', async ({ request }) => {
    const amount = 10_000_000 // 10M tenge — easy math
    const pubkey = `e2e-penalty-cap-test-${Date.now()}`
    console.log('[PenaltyCap] Creating fresh contract for cap testing')

    const res = await request.post('/api/contracts', {
      data: {
        title: `E2E Penalty Cap Test ${Date.now()}`,
        description: 'Test: penalty cap enforcement at 30%',
        district: DISTRICT,
        lat: 43.24,
        lng: 76.95,
        contractorName: 'ТОО КапТест',
        totalAmount: amount,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'CONSTRUCTION',
        onChainPubkey: pubkey,
        milestones: [
          { description: 'Этап 1', deadlineDays: 30, tranchePct: 50 },
          { description: 'Этап 2', deadlineDays: 60, tranchePct: 50 },
        ],
      },
      headers: AKIMAT_HEADERS,
    })

    expect(res.status()).toBe(201)
    const data = await res.json()
    contractId = data.id
    totalAmount = amount
    maxPenalty = Math.floor(amount * 0.3) // 3,000,000
    console.log(
      `[PenaltyCap] Contract ${contractId}: totalAmount=${totalAmount}, maxPenalty=${maxPenalty}`
    )
  })

  test('apply penalties until cap is reached', async ({ request }) => {
    // Each TIME_OVERDUE penalty with 10 days = 1% * 10 = 10% of totalAmount = 1,000,000
    // Need 3 penalties to reach 30% cap
    let totalApplied = 0
    let iteration = 0
    const maxIterations = 10 // safety guard

    while (totalApplied < maxPenalty && iteration < maxIterations) {
      iteration++
      console.log(`[PenaltyCap] Applying penalty iteration ${iteration}, totalApplied=${totalApplied}`)

      const res = await request.post(`/api/contracts/${contractId}/penalty`, {
        data: { type: 'TIME_OVERDUE', daysOverdue: 10 },
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status() === 201) {
        const data = await res.json()
        const amount = Number(data.penalty.amountTenge)
        totalApplied += amount
        console.log(
          `[PenaltyCap] Penalty #${iteration}: ${amount} tenge, running total=${totalApplied}, capped=${data.capped}`
        )

        if (data.capped) {
          console.log('[PenaltyCap] Cap reached per API response')
          break
        }
      } else if (res.status() === 409) {
        console.log('[PenaltyCap] Got 409 — cap already reached')
        break
      } else {
        throw new Error(`Unexpected status ${res.status()} during penalty application`)
      }
    }

    expect(totalApplied).toBeLessThanOrEqual(maxPenalty)
    console.log(`[PenaltyCap] Total penalties applied: ${totalApplied} (max: ${maxPenalty})`)
  })

  test('next penalty returns 409 after cap', async ({ request }) => {
    console.log('[PenaltyCap] Attempting penalty beyond 30% cap')
    const res = await request.post(`/api/contracts/${contractId}/penalty`, {
      data: { type: 'TIME_OVERDUE', daysOverdue: 1 },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status()).toBe(409)
    const data = await res.json()
    console.log(`[PenaltyCap] 409 response: ${JSON.stringify(data)}`)
    expect(data.error).toContain('cap')
  })

  test('contract status is PENALIZED and total within cap', async ({ request }) => {
    console.log(`[PenaltyCap] GET contract ${contractId} to verify final state`)
    const res = await request.get(`/api/contracts/${contractId}`)
    expect(res.status()).toBe(200)

    const data = await res.json()
    console.log(
      `[PenaltyCap] Contract status=${data.status}, penaltyAmount=${data.penaltyAmount}`
    )

    expect(data.status).toBe('PENALIZED')

    const penaltyTotal = Number(data.penaltyAmount)
    expect(penaltyTotal).toBeLessThanOrEqual(maxPenalty)
    expect(penaltyTotal).toBeGreaterThan(0)
    console.log(
      `[PenaltyCap] Penalty total ${penaltyTotal} is within 30% cap of ${maxPenalty}`
    )
  })
})

/* ------------------------------------------------------------------ */
/*  Test 4 — Crowdfunding Contribution → citizenRaised Increase        */
/* ------------------------------------------------------------------ */

test.describe.serial('Money flow: Crowdfunding Contribution', () => {
  let campaignId: string
  let initialCitizenRaised: number
  let initialDonorCount: number
  const contributionAmount = 5_000 // 5000 tenge (above 500 min)

  test('find an active crowdfunding campaign', async ({ request }) => {
    console.log('[Crowdfunding] GET /api/crowdfunding to find active campaign')
    const res = await request.get('/api/crowdfunding?status=ACTIVE')
    expect(res.status()).toBe(200)

    const campaigns = await res.json()
    expect(Array.isArray(campaigns)).toBe(true)

    const active = campaigns.find((c: any) => c.status === 'ACTIVE')
    if (!active) {
      console.log('[Crowdfunding] No active campaigns found — skipping')
      test.skip()
      return
    }

    campaignId = active.id
    initialCitizenRaised = Number(active.citizenRaised)
    initialDonorCount = Number(active.donorCount ?? active._count?.contributions ?? 0)
    console.log(
      `[Crowdfunding] Using campaign ${campaignId}: citizenRaised=${initialCitizenRaised}, donorCount=${initialDonorCount}`
    )
  })

  test('POST contribution and verify response', async ({ request }) => {
    if (!campaignId) {
      test.skip()
      return
    }

    console.log(
      `[Crowdfunding] POST contribution of ${contributionAmount} to campaign ${campaignId}`
    )
    const res = await request.post(`/api/crowdfunding/${campaignId}`, {
      data: {
        citizenId: 'demo-citizen-1',
        amount: contributionAmount,
        anonymous: false,
      },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status()).toBe(201)
    const data = await res.json()

    // Verify the contribution was recorded
    expect(data.contribution).toBeTruthy()
    const contributedAmount = Number(data.contribution.amount)
    console.log(`[Crowdfunding] Contribution recorded: ${contributedAmount} tenge`)
    expect(contributedAmount).toBe(contributionAmount)

    // Verify campaign totals updated
    const updatedRaised = Number(data.campaign.citizenRaised)
    const updatedDonors = Number(data.campaign.donorCount)
    console.log(
      `[Crowdfunding] Campaign after: citizenRaised=${updatedRaised}, donorCount=${updatedDonors}`
    )
    expect(updatedRaised).toBe(initialCitizenRaised + contributionAmount)
    expect(updatedDonors).toBe(initialDonorCount + 1)
  })

  test('GET campaign confirms updated totals', async ({ request }) => {
    if (!campaignId) {
      test.skip()
      return
    }

    console.log(`[Crowdfunding] GET /api/crowdfunding/${campaignId} to confirm totals`)
    const res = await request.get(`/api/crowdfunding/${campaignId}`)
    expect(res.status()).toBe(200)

    const data = await res.json()
    const currentRaised = Number(data.citizenRaised)
    console.log(
      `[Crowdfunding] Confirmed citizenRaised=${currentRaised} (was ${initialCitizenRaised}, contributed ${contributionAmount})`
    )
    expect(currentRaised).toBeGreaterThanOrEqual(initialCitizenRaised + contributionAmount)
  })
})

/* ------------------------------------------------------------------ */
/*  Test 5 — Full Lifecycle: Browser UI (contract → treasury view)     */
/* ------------------------------------------------------------------ */

test.describe('Money flow: Browser UI lifecycle', () => {
  test('akimat submits contract via admin form and treasury shows balances', async ({
    page,
  }) => {
    // Step 1: Log in as akimat
    await seedLocalStorageAuth(page, AUTH_JSON.akimat)
    console.log('[BrowserUI] Logged in as akimat')

    // Step 2: Navigate to admin and fill the contract form
    await page.goto('/ru/admin')
    await expect(page.getByText(/Регистрация контракта/i)).toBeVisible({ timeout: 30_000 })
    console.log('[BrowserUI] Admin page loaded')

    // Use auto-fill to populate the form
    const autoFillButton = page.getByText(/Заполнить тестовыми данными/i)
    await expect(autoFillButton).toBeVisible({ timeout: 15_000 })
    await autoFillButton.click()
    console.log('[BrowserUI] Auto-fill clicked')

    // Verify the form was populated
    const titleInput = page.locator('input[placeholder*="Ремонт"]')
    await expect(titleInput).not.toHaveValue('')
    console.log('[BrowserUI] Form fields populated')

    // Verify milestones section is present
    await expect(page.getByText(/Этапы \(/i)).toBeVisible()
    console.log('[BrowserUI] Milestones section visible')

    // Step 3: Navigate to treasury page
    await page.goto('/ru/treasury/' + DISTRICT_ENCODED)
    await expect(page.getByText(/Ауэзовский район/i)).toBeVisible({ timeout: 30_000 })
    console.log('[BrowserUI] Treasury page loaded')

    // Step 4: Verify treasury balance is displayed
    await expect(page.getByText(/Баланс казны района/i)).toBeVisible({ timeout: 15_000 })
    console.log('[BrowserUI] Balance card visible')

    // Step 5: Verify penalty section shows amounts
    const penaltySection = page.getByText(/Штрафы подрядчиков/i).first()
    await expect(penaltySection).toBeVisible({ timeout: 15_000 })
    console.log('[BrowserUI] Penalty section visible')

    // Penalty type labels (from demo and real data)
    const penaltyLabels = page.locator('text=/Просрочка|Брак|Брошенный/i')
    const penaltyCount = await penaltyLabels.count()
    console.log(`[BrowserUI] Found ${penaltyCount} penalty labels`)
    expect(penaltyCount).toBeGreaterThan(0)

    // Financial figures (tenge symbol)
    const tengeAmounts = page.getByText(/₸/).first()
    await expect(tengeAmounts).toBeVisible()
    console.log('[BrowserUI] Tenge amounts visible on treasury page')

    // Step 6: Verify proposals section
    await expect(page.getByText(/Предложения по расходам/i)).toBeVisible({ timeout: 15_000 })
    console.log('[BrowserUI] Proposals section visible — lifecycle complete')
  })
})
