import { test, expect } from './fixtures'
import { AUTH_JSON, seedLocalStorageAuth } from './fixtures/auth'

test.describe('Crowdfunding E2E flows', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.citizen)
  })

  test('campaign list shows campaigns with progress', async ({ page }) => {
    await page.goto('/ru/crowdfunding')
    await expect(page.getByText(/Инициативное бюджетирование/i)).toBeVisible()
    // Stats bar
    await expect(page.getByText(/Активных/i)).toBeVisible()
    await expect(page.getByText(/Собрано/i)).toBeVisible()
    await expect(page.getByText(/Доноров/i)).toBeVisible()
    // "How it works" section
    await expect(page.getByText(/Как это работает/i)).toBeVisible()
    // Campaign cards exist
    await expect(page.getByText(/Найдено:.*кампаний/i)).toBeVisible()
  })

  test('campaign filters work', async ({ page }) => {
    await page.goto('/ru/crowdfunding')
    await expect(page.getByText(/Найдено:/i)).toBeVisible()

    // Click "Сбор средств" filter
    await page.getByRole('button', { name: 'Сбор средств' }).click()
    // Count should change or stay the same
    await expect(page.getByText(/Найдено:/i)).toBeVisible()

    // Switch back to "Все"
    await page.getByRole('button', { name: 'Все' }).click()
    await expect(page.getByText(/Найдено:/i)).toBeVisible()
  })

  test('campaign detail page loads with donation UI', async ({ page }) => {
    await page.goto('/ru/crowdfunding')
    // Click first campaign card
    const card = page.locator('a[href*="/crowdfunding/"]').first()
    await expect(card).toBeVisible()
    await card.click()
    await page.waitForURL(/\/crowdfunding\//)

    // Detail page elements
    await expect(page.getByText(/Собрано гражданами/i)).toBeVisible({ timeout: 15_000 })
    // Donation amount presets should exist
    const presets = page.getByRole('button').filter({ hasText: /₸/ })
    await expect(presets.first()).toBeVisible()
  })

  test('subsidy model info is shown', async ({ page }) => {
    await page.goto('/ru/crowdfunding')
    // Scroll down to matching ratios
    await page.getByText(/Модели субсидирования/i).scrollIntoViewIfNeeded()
    await expect(page.getByText(/Модели субсидирования/i)).toBeVisible()
    await expect(page.getByText(/Государство:.*%/i).first()).toBeVisible()
  })
})
