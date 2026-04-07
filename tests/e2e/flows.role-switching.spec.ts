import { test, expect } from './fixtures'
import { AUTH_JSON, seedLocalStorageAuth } from './fixtures/auth'

test.describe('Role switching E2E', () => {
  test('demo login as citizen works', async ({ page }) => {
    await page.goto('/ru/login')
    await expect(page.getByText(/Тестовый доступ/i)).toBeVisible()
    // Click citizen demo button
    await page.getByRole('button', { name: /Гражданин/i }).click()
    // Should redirect to home
    await page.waitForURL(/\/ru\/?$/)
    // Nav should show citizen links
    await expect(page.locator('nav').getByText('Профиль')).toBeVisible()
  })

  test('demo login as contractor works', async ({ page }) => {
    await page.goto('/ru/login')
    await page.getByRole('button', { name: /Подрядчик/i }).click()
    await page.waitForURL(/\/contractor/)
    await expect(page.getByText(/СтройАлматы/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('demo login as akimat works', async ({ page }) => {
    await page.goto('/ru/login')
    await page.getByRole('button', { name: /Представитель акимата/i }).click()
    await page.waitForURL(/\/akimat/)
    await expect(page.getByText(/Сотрудник акимата/i)).toBeVisible({ timeout: 15_000 })
  })

  test('role switcher shows all 3 roles for demo user', async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.citizen)
    await page.goto('/ru')
    // Click user dropdown in navbar
    const userButton = page.locator('nav').locator('button').filter({ hasText: /Алибек|Демо/i })
    await expect(userButton).toBeVisible()
    await userButton.click()
    // Dropdown should show all 3 demo role names
    await expect(page.getByText(/Алибек/i).last()).toBeVisible()
    await expect(page.getByText(/СтройАлматы/i).last()).toBeVisible()
    await expect(page.getByText(/Сотрудник акимата/i).last()).toBeVisible()
    await expect(page.getByText(/Выйти/i)).toBeVisible()
  })

  test('logout redirects to login page', async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.citizen)
    await page.goto('/ru')
    // Open dropdown
    const userButton = page.locator('nav').locator('button').filter({ hasText: /Алибек|Демо/i })
    await userButton.click()
    // Click logout
    await page.getByText('Выйти').click()
    await page.waitForURL(/\/login/)
    await expect(page.getByText(/Вход в систему/i)).toBeVisible()
  })

  test('contractor is redirected from citizen pages', async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.contractor)
    // Contractor visiting crowdfunding should redirect to contractor home
    await page.goto('/ru/crowdfunding')
    await page.waitForURL(/\/contractor/)
  })
})
