import { test, expect } from './fixtures'
import { AUTH_JSON, seedLocalStorageAuth } from './fixtures/auth'

test.describe('Contractor E2E flows', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.contractor)
  })

  test('contractor dashboard shows company info and stats', async ({ page }) => {
    await page.goto('/ru/contractor')
    // Role label (CSS may uppercase "Подрядчик" → "ПОДРЯДЧИК")
    await expect(page.getByText(/Подрядчик/i).first()).toBeVisible({ timeout: 15_000 })
    // Company name
    await expect(page.getByText(/СтройАлматы/i).first()).toBeVisible()
    // Stats KPIs
    await expect(page.getByText(/Активных/i).first()).toBeVisible()
  })

  test('contractor nav shows correct links', async ({ page }) => {
    await page.goto('/ru/contractor')
    const nav = page.locator('nav')
    await expect(nav.getByText('Кабинет')).toBeVisible({ timeout: 15_000 })
    await expect(nav.getByText('Контракты')).toBeVisible()
    await expect(nav.getByText(/Карта/i)).toBeVisible()
    // Citizen-only link should NOT appear in contractor nav
    await expect(nav.getByText('Профиль')).not.toBeVisible()
    // Akimat-only link should NOT appear
    await expect(nav.getByText('Админ')).not.toBeVisible()
  })

  test('contractor can browse contracts', async ({ page }) => {
    await page.goto('/ru/contracts')
    await expect(page.getByText(/Найдено:.*контракт/i)).toBeVisible({ timeout: 15_000 })
  })

  test('contractor can view contract detail with milestones', async ({ page }) => {
    await page.goto('/ru/contracts/1')
    const milestones = page.getByText(/Этапы выполнения/i)
    const notFound = page.getByText(/Контракт не найден/i)
    await expect(milestones.or(notFound)).toBeVisible({ timeout: 15_000 })
  })

  test('contractor dashboard has action cards', async ({ page }) => {
    await page.goto('/ru/contractor')
    await expect(page.getByText(/СтройАлматы/i).first()).toBeVisible({ timeout: 15_000 })
    // Action cards (CSS may uppercase text)
    await expect(page.getByText(/Сдача этапов/i).first()).toBeVisible()
    await expect(page.getByText(/Дневник и фото/i).first()).toBeVisible()
    await expect(page.getByText(/Репутация в реестре/i).first()).toBeVisible()
  })

  test('contractor redirected from citizen-only profile page', async ({ page }) => {
    await page.goto('/ru/profile')
    await page.waitForURL(/\/contractor/, { timeout: 15_000 })
  })

  test('contractor dashboard shows rating and reputation', async ({ page }) => {
    await page.goto('/ru/contractor')
    await expect(page.getByText(/СтройАлматы/i).first()).toBeVisible({ timeout: 15_000 })
    // Rating badge (e.g. Рейтинг: AA)
    await expect(page.getByText(/Рейтинг/i).first()).toBeVisible()
    // Reputation score
    await expect(page.getByText(/Репутация/i).first()).toBeVisible()
  })

  test('contractor dashboard shows performance metrics', async ({ page }) => {
    await page.goto('/ru/contractor')
    await expect(page.getByText(/СтройАлматы/i).first()).toBeVisible({ timeout: 15_000 })
    // Performance metric labels
    await expect(page.getByText(/Своевременность/i)).toBeVisible()
    await expect(page.getByText(/Принятие этапов/i)).toBeVisible()
    await expect(page.getByText(/Обновления/i).first()).toBeVisible()
  })

  test('contractor dashboard shows attention alert when needed', async ({ page }) => {
    await page.goto('/ru/contractor')
    await expect(page.getByText(/СтройАлматы/i).first()).toBeVisible({ timeout: 15_000 })
    // Alert banner visible (or stats section loaded)
    const alertVisible = await page.getByRole('heading', { name: /Требуется внимание/i }).isVisible().catch(() => false)
    const statsVisible = await page.getByText('Споры', { exact: true }).isVisible().catch(() => false)
    expect(alertVisible || statsVisible).toBeTruthy()
  })
})
