import { test, expect } from './fixtures'
import { AUTH_JSON, seedLocalStorageAuth } from './fixtures/auth'

test.describe('Akimat E2E flows', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.akimat)
  })

  test('akimat dashboard shows overview stats', async ({ page }) => {
    await page.goto('/ru/akimat')
    await expect(page.getByText(/Сотрудник акимата/i)).toBeVisible()
    // Stats cards
    await expect(page.getByText(/Записей в базе данных/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Активных/i).first()).toBeVisible()
    // Actions section
    await expect(page.getByText(/Действия/i)).toBeVisible()
    await expect(page.getByText(/Зарегистрировать контракт/i)).toBeVisible()
  })

  test('akimat dashboard → admin form navigation', async ({ page }) => {
    await page.goto('/ru/akimat')
    await page.getByText(/Зарегистрировать контракт/i).click()
    await page.waitForURL(/\/admin/)
    await expect(page.getByText(/Регистрация контракта/i)).toBeVisible({ timeout: 15_000 })
  })

  test('admin form has required fields', async ({ page }) => {
    await page.goto('/ru/admin')
    await expect(page.getByText(/Регистрация контракта/i)).toBeVisible({ timeout: 15_000 })
    // Form fields exist
    await expect(page.getByText(/Название контракта/i)).toBeVisible()
    await expect(page.getByText(/Подрядчик/i).first()).toBeVisible()
    await expect(page.getByText(/Сумма/i)).toBeVisible()
    await expect(page.getByText(/Дедлайн/i)).toBeVisible()
    await expect(page.getByText(/Район/i).first()).toBeVisible()
    // Milestone tabs
    await expect(page.getByText(/Этапы \(\d+\)/i)).toBeVisible()
    // Auto-fill button
    await expect(page.getByText(/Заполнить тестовыми данными/i)).toBeVisible()
  })

  test('admin form auto-fill works', async ({ page }) => {
    await page.goto('/ru/admin')
    await expect(page.getByText(/Заполнить тестовыми данными/i)).toBeVisible({ timeout: 15_000 })
    await page.getByText(/Заполнить тестовыми данными/i).click()

    // After auto-fill, title input should be non-empty
    const titleInput = page.locator('input[placeholder*="Ремонт"]')
    await expect(titleInput).not.toHaveValue('')
  })

  test('akimat nav has correct links', async ({ page }) => {
    await page.goto('/ru/akimat')
    const nav = page.locator('nav')
    await expect(nav.getByRole('link', { name: 'Акимат' })).toBeVisible()
    await expect(nav.getByText('Контракты')).toBeVisible()
    await expect(nav.getByText('Краудфандинг')).toBeVisible()
    await expect(nav.getByText('Казна')).toBeVisible()
    await expect(nav.getByText('Админ')).toBeVisible()
    // No blockchain link
    await expect(nav.getByText('Блокчейн')).not.toBeVisible()
  })
})
