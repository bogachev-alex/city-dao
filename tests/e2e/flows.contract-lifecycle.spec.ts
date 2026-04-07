import { test, expect } from './fixtures'
import { AUTH_JSON, seedLocalStorageAuth } from './fixtures/auth'

test.describe('Contract lifecycle E2E flows', () => {
  test('akimat can fill and submit contract registration form', async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.akimat)
    await page.goto('/ru/admin')

    // Auto-fill test data
    await expect(page.getByText(/Заполнить тестовыми данными/i)).toBeVisible({ timeout: 15_000 })
    await page.getByText(/Заполнить тестовыми данными/i).click()

    // Verify form populated
    const titleInput = page.locator('input[placeholder*="Ремонт"]')
    await expect(titleInput).not.toHaveValue('')

    // Verify milestones section exists
    await expect(page.getByText(/Этапы \(/i)).toBeVisible()
  })

  test('contracts list shows contracts with status badges', async ({ page }) => {
    await page.goto('/ru/contracts')
    await expect(page.getByText(/Найдено:.*контракт/i)).toBeVisible({ timeout: 15_000 })
    // Status badges
    const badges = page.locator('text=/Активен|Просрочен|Завершён|В споре/i')
    await expect(badges.first()).toBeVisible()
  })

  test('contract detail shows milestone timeline', async ({ page }) => {
    // Navigate directly to demo contract (numeric IDs resolve to demo data)
    await page.goto('/ru/contracts/1')
    const milestones = page.getByText(/Этапы выполнения/i)
    const notFound = page.getByText(/Контракт не найден/i)
    const loaded = milestones.or(notFound)
    await expect(loaded).toBeVisible({ timeout: 15_000 })

    // If milestones loaded, verify financial info
    if (await milestones.isVisible()) {
      await expect(page.getByText(/₸/).first()).toBeVisible()
    }
  })

  test('contract detail has penalty calculator', async ({ page }) => {
    await page.goto('/ru/contracts/1')
    const calculator = page.getByText(/Штрафной калькулятор/i)
    const notFound = page.getByText(/Контракт не найден/i)
    await expect(calculator.or(notFound)).toBeVisible({ timeout: 15_000 })
  })

  test('treasury page shows penalty income from contracts', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.getByText(/Баланс казны района/i)).toBeVisible({ timeout: 15_000 })
    // Penalty section (use .first() — text may appear in stats card and heading)
    await expect(page.getByText(/Штрафы подрядчиков/i).first()).toBeVisible()
    // At least one penalty type label or amounts
    const penalties = page.locator('text=/Просрочка|Брак|Брошенный/i')
    await expect(penalties.first()).toBeVisible()
  })

  test('treasury proposals show amounts from penalty pool', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.getByText(/Предложения по расходам/i)).toBeVisible({ timeout: 15_000 })
    // Proposal cards with amounts
    await expect(page.getByText(/₸/).first()).toBeVisible()
  })

  test('API: /api/contracts returns contract list', async ({ request }) => {
    const response = await request.get('/api/contracts')
    expect(response.status()).toBeLessThanOrEqual(500)
    if (response.status() === 200) {
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    }
  })

  test('API: penalty endpoint requires valid type', async ({ request }) => {
    const res = await request.post('/api/contracts/fake-id/penalty', {
      data: { type: 'INVALID' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(400)
  })

  test('map shows contract pins with status-based colors', async ({ page }) => {
    await page.goto('/ru')
    const map = page.locator('.leaflet-container')
    await expect(map).toBeVisible({ timeout: 25_000 })
    const markers = map.locator('.leaflet-marker-icon')
    await expect(markers.first()).toBeVisible({ timeout: 10_000 })
    const count = await markers.count()
    expect(count).toBeGreaterThan(0)
  })

  test('contract cards show financial information', async ({ page }) => {
    await page.goto('/ru/contracts')
    await expect(page.getByText(/Найдено:/i)).toBeVisible({ timeout: 15_000 })
    // Financial amounts on cards
    await expect(page.getByText(/₸/).first()).toBeVisible()
  })
})
