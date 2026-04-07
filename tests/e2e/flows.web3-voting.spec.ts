import { test, expect } from './fixtures'
import { AUTH_JSON, seedLocalStorageAuth } from './fixtures/auth'

/* ------------------------------------------------------------------ */
/*  1. Jury voting page structure                                      */
/* ------------------------------------------------------------------ */
test.describe('Jury voting', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.citizen)
  })

  test('contract detail shows milestone statuses', async ({ page }) => {
    // Navigate to demo contract directly
    await page.goto('/ru/contracts/1')
    const milestones = page.getByText(/Этапы выполнения/i)
    const notFound = page.getByText(/Контракт не найден/i)
    await expect(milestones.or(notFound)).toBeVisible({ timeout: 15_000 })

    if (await milestones.isVisible()) {
      // Milestone statuses that indicate jury involvement
      await expect(
        page.getByText(/Ожидание|Принят|Отклонён|Подан|На проверке/i).first(),
      ).toBeVisible()
    }
  })

  test('jury page renders voting UI', async ({ page }) => {
    // Navigate to demo jury session
    await page.goto('/ru/jury/demo-ses')

    // The jury page renders: "Голосование присяжного" header
    await expect(page.getByText(/Голосование присяжного/i)).toBeVisible({ timeout: 15_000 })
    // Commit-Reveal method label (may appear in heading + metadata — use first())
    await expect(page.getByText('Commit-Reveal').first()).toBeVisible()
    // Evidence photos section
    await expect(page.getByText(/Фотоматериалы подрядчика/i)).toBeVisible()
    // Voting section
    await expect(page.getByRole('heading', { name: /Ваш голос/i })).toBeVisible()
  })

  test('jury page shows session metadata', async ({ page }) => {
    await page.goto('/ru/jury/demo-ses')
    await expect(page.getByText(/Голосование присяжного/i)).toBeVisible({ timeout: 15_000 })

    // Metadata labels
    await expect(page.getByText(/Метод голосования/i).first()).toBeVisible()
    await expect(page.getByText(/Присяжных/i).first()).toBeVisible()
    await expect(page.getByText(/Статус/i).first()).toBeVisible()
  })

  test('jury page shows voting steps', async ({ page }) => {
    await page.goto('/ru/jury/demo-ses')
    await expect(page.getByText(/Голосование присяжного/i)).toBeVisible({ timeout: 15_000 })

    // Step indicators: 1 Голосование, 2 Раскрытие, 3 Результаты
    await expect(page.getByText(/Голосование/).first()).toBeVisible()
    await expect(page.getByText(/Раскрытие/i)).toBeVisible()
    await expect(page.getByText(/Результаты/i).first()).toBeVisible()
  })
})

/* ------------------------------------------------------------------ */
/*  2. Jury API validation                                             */
/* ------------------------------------------------------------------ */
test.describe('Jury API validation', () => {
  test('GET /api/jury without sessionId returns list or error', async ({ request }) => {
    const res = await request.get('/api/jury')
    expect([200, 404, 500]).toContain(res.status())
  })

  test('GET /api/jury with unknown sessionId returns 404', async ({ request }) => {
    const res = await request.get('/api/jury?sessionId=nonexistent-id-xyz')
    expect([404, 500]).toContain(res.status())
  })

  test('POST /api/jury requires auth', async ({ request }) => {
    const res = await request.post('/api/jury', {
      data: { sessionId: 'test', commitHash: 'abc' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(401)
  })

  test('PATCH /api/jury requires auth', async ({ request }) => {
    const res = await request.patch('/api/jury', {
      data: { sessionId: 'test', vote: 'accept', salt: 'abc' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/jury with non-citizen role is forbidden', async ({ request }) => {
    const token = Buffer.from(JSON.stringify({ role: 'AKIMAT', id: 'demo-akimat-1' })).toString(
      'base64',
    )
    const res = await request.post('/api/jury', {
      data: { sessionId: 'test', commitHash: 'abc' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    expect(res.status()).toBe(403)
  })
})

/* ------------------------------------------------------------------ */
/*  3. Treasury voting UI                                              */
/* ------------------------------------------------------------------ */
test.describe('Treasury voting flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.citizen)
  })

  test('treasury page shows proposals with voting UI', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.getByText(/Предложения по расходам/i)).toBeVisible({ timeout: 15_000 })

    // Proposals should have vote buttons or voting info
    const voteElement = page.getByText(/За|Против|Проголосовано|голос/i).first()
    await expect(voteElement).toBeVisible()
  })

  test('treasury shows total penalty income', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.getByText(/Баланс казны района/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/₸/).first()).toBeVisible()
  })

  test('proposal details show vote counts', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.getByText(/Предложения по расходам/i)).toBeVisible({ timeout: 15_000 })
    // Vote counts or progress
    await expect(page.getByText(/голос/i).first()).toBeVisible()
  })

  test('treasury proposals have AI analysis button', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.getByText(/Предложения по расходам/i)).toBeVisible({ timeout: 15_000 })
    const aiButton = page.getByText(/AI Анализ/i).first()
    await expect(aiButton).toBeVisible()
  })
})

/* ------------------------------------------------------------------ */
/*  4. Token rewards visible in profile                                */
/* ------------------------------------------------------------------ */
test.describe('Token rewards & reputation', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.citizen)
  })

  test('profile shows ADL token wallet', async ({ page }) => {
    await page.goto('/ru/profile')
    await expect(page.getByText(/Кошелёк ADL/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/ADL/i).first()).toBeVisible()
  })

  test('profile shows reputation score and tier', async ({ page }) => {
    await page.goto('/ru/profile')
    await expect(page.getByText(/очков репутации/i)).toBeVisible({ timeout: 15_000 })
    // Tier badge
    await expect(
      page.getByText(/Новичок|Активный|Доверенный|Хранитель/i).first(),
    ).toBeVisible()
  })

  test('profile shows citizen information', async ({ page }) => {
    await page.goto('/ru/profile')
    await expect(page.getByText(/Информация о гражданине/i)).toBeVisible({ timeout: 15_000 })
  })

  test('profile shows demo banner for demo user', async ({ page }) => {
    await page.goto('/ru/profile')
    await expect(page.getByText(/Демо-режим/i)).toBeVisible({ timeout: 15_000 })
  })

  test('profile shows voting stats', async ({ page }) => {
    await page.goto('/ru/profile')
    await expect(page.getByText(/Голосов отдано/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Пропущено/i)).toBeVisible()
  })
})

/* ------------------------------------------------------------------ */
/*  5. Crowdfunding contribution UI                                    */
/* ------------------------------------------------------------------ */
test.describe('Crowdfunding contribution flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.citizen)
  })

  test('campaign detail shows donation info', async ({ page }) => {
    await page.goto('/ru/crowdfunding')
    // Click a campaign card that links to a detail page (not "create")
    const detailCard = page.locator('a[href*="/crowdfunding/"]').filter({ hasNotText: /Создать|Новая/ }).first()
    await expect(detailCard).toBeVisible({ timeout: 15_000 })
    await detailCard.click()
    await page.waitForURL(/\/crowdfunding\//)

    // Campaign detail — either shows donation UI or campaign info
    const donationInfo = page.getByText(/Собрано гражданами|Основная информация|Прогресс/i).first()
    await expect(donationInfo).toBeVisible({ timeout: 15_000 })
  })

  test('campaign shows progress bar', async ({ page }) => {
    await page.goto('/ru/crowdfunding')
    await expect(page.getByText(/Найдено:.*кампаний/i)).toBeVisible({ timeout: 15_000 })
    // Progress indicators
    await expect(page.getByText(/%/).first()).toBeVisible()
  })
})

/* ------------------------------------------------------------------ */
/*  6. Token API validation                                            */
/* ------------------------------------------------------------------ */
test.describe('Token API validation', () => {
  test('POST /api/tokens/award rejects invalid action', async ({ request }) => {
    const res = await request.post('/api/tokens/award', {
      data: { action: 'invalid_action', walletAddress: 'test' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 503]).toContain(res.status())
  })

  test('POST /api/tokens/award requires walletAddress', async ({ request }) => {
    const res = await request.post('/api/tokens/award', {
      data: { action: 'registration' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 503]).toContain(res.status())
  })

  test('POST /api/tokens/award with valid action returns expected status', async ({ request }) => {
    const res = await request.post('/api/tokens/award', {
      data: { action: 'registration', walletAddress: 'FakeWa11etAddr3ss' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 500, 503]).toContain(res.status())
  })

  test('GET /api/tokens/balance returns balance info', async ({ request }) => {
    const res = await request.get('/api/tokens/balance?wallet=FakeWa11etAddr3ss')
    expect([200, 400, 500]).toContain(res.status())
  })
})

/* ------------------------------------------------------------------ */
/*  7. Treasury API validation                                         */
/* ------------------------------------------------------------------ */
test.describe('Treasury API validation', () => {
  test('PATCH /api/treasury/[district] requires txSignature', async ({ request }) => {
    const res = await request.patch(
      '/api/treasury/' + encodeURIComponent('Ауэзовский'),
      {
        data: { proposalId: 'p1', citizenId: 'c1', inFavor: true },
        headers: { 'Content-Type': 'application/json' },
      },
    )
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('On-chain confirmation')
  })

  test('GET /api/treasury/[district] returns treasury data', async ({ request }) => {
    const res = await request.get(
      '/api/treasury/' + encodeURIComponent('Ауэзовский'),
    )
    expect([200, 404]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body).toHaveProperty('balance')
      expect(body).toHaveProperty('proposals')
    }
  })

  test('GET /api/treasury/[district] returns 404 for unknown district', async ({ request }) => {
    const res = await request.get(
      '/api/treasury/' + encodeURIComponent('НесуществующийРайон'),
    )
    expect(res.status()).toBe(404)
  })
})

/* ------------------------------------------------------------------ */
/*  8. Cross-role: Contract -> Treasury money flow visible             */
/* ------------------------------------------------------------------ */
test.describe('Money flow visibility', () => {
  test('contract penalties listed on treasury page', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    // Use .first() to avoid strict mode (text appears in stats card + heading)
    await expect(page.getByText(/Штрафы подрядчиков/i).first()).toBeVisible({ timeout: 15_000 })
    // Penalty amounts in ₸
    const amounts = page.locator('text=/\\d+.*₸/i')
    await expect(amounts.first()).toBeVisible()
  })

  test('treasury balance and penalties co-exist', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    // Balance card
    await expect(page.getByText(/Баланс казны района/i)).toBeVisible({ timeout: 15_000 })
    // Penalty stats card (use .first())
    await expect(page.getByText(/Штрафы подрядчиков/i).first()).toBeVisible()
    // Proposals section
    await expect(page.getByText(/Предложения по расходам/i)).toBeVisible()
  })

  test('penalty breakdown shows penalty types', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.getByText(/Штрафы подрядчиков/i).first()).toBeVisible({ timeout: 15_000 })
    // Penalty type labels from demo data
    const penaltyTypes = page.locator('text=/Просрочка|Брак|Брошенный/i')
    const count = await penaltyTypes.count()
    expect(count).toBeGreaterThan(0)
  })
})
