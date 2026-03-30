import { test, expect } from './fixtures'
import { AUTH_JSON, seedLocalStorageAuth } from './fixtures/auth'

test.describe('Role-gated areas (demo auth)', () => {
  test('contractor cabinet loads', async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.contractor)
    await page.goto('/ru/contractor')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/ТОО СтройАлматы|СтройАлматы/)).toBeVisible()
  })

  test('akimat cabinet loads', async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.akimat)
    await page.goto('/ru/akimat')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('admin page for AKIMAT', async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.akimat)
    await page.goto('/ru/admin')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('citizen profile page', async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.citizen)
    await page.goto('/ru/profile')
    await expect(page.locator('body')).toBeVisible()
  })
})
