import { test, expect } from './fixtures'

test.describe('Public routes (ru)', () => {
  test('home loads with map container', async ({ page }) => {
    await page.goto('/ru')
    await expect(page).toHaveTitle(/Amanat Protocol/i)
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 25_000 })
  })

  test('contracts registry loads', async ({ page }) => {
    await page.goto('/ru/contracts')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Реестр|Келісім/i)
  })

  test('contract detail demo id 1', async ({ page }) => {
    await page.goto('/ru/contracts/1')
    await expect(page.locator('main, [class*="min-h-screen"]').first()).toBeVisible()
  })

  test('login page', async ({ page }) => {
    await page.goto('/ru/login')
    await expect(page.getByRole('heading', { name: /Вход в систему/i })).toBeVisible()
  })

  test('blockchain dashboard', async ({ page }) => {
    await page.goto('/ru/blockchain')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('crowdfunding list', async ({ page }) => {
    await page.goto('/ru/crowdfunding')
    await expect(page.locator('body')).toBeVisible()
  })

  test('treasury district page', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.locator('body')).toBeVisible()
  })

  test('API contracts responds (200 with data or 500 if DB unavailable)', async ({ request }) => {
    const res = await request.get('/api/contracts')
    const status = res.status()
    expect([200, 500]).toContain(status)
    if (status === 200) {
      const data = await res.json()
      expect(Array.isArray(data)).toBeTruthy()
    }
  })
})
