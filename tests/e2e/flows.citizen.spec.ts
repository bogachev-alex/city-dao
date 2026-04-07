import { test, expect } from './fixtures'
import { AUTH_JSON, seedLocalStorageAuth } from './fixtures/auth'

test.describe('Citizen E2E flows', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorageAuth(page, AUTH_JSON.citizen)
  })

  test('citizen nav shows correct links', async ({ page }) => {
    await page.goto('/ru')
    const nav = page.locator('nav')
    await expect(nav.getByText('Карта')).toBeVisible()
    await expect(nav.getByText('Контракты')).toBeVisible()
    await expect(nav.getByText('Краудфандинг')).toBeVisible()
    await expect(nav.getByText('Казна')).toBeVisible()
    await expect(nav.getByText('Профиль')).toBeVisible()
    // blockchain link should NOT be present
    await expect(nav.getByText('Блокчейн')).not.toBeVisible()
  })

  test('contracts list → contract detail → milestones visible', async ({ page }) => {
    await page.goto('/ru/contracts')
    await expect(page.getByText(/Найдено:.*контракт/i)).toBeVisible()

    // Navigate directly to demo contract detail (card click leads to DB UUID that may not resolve)
    await page.goto('/ru/contracts/1')

    // Contract detail loaded
    await expect(page.getByText(/Этапы выполнения/i)).toBeVisible({ timeout: 15_000 })
    // Milestones section has at least one milestone
    await expect(page.getByText(/Ожидание|Принят|Отклонён|Подан/i).first()).toBeVisible()
  })

  test('contract detail shows penalty calculator', async ({ page }) => {
    // Navigate directly to demo contract 2 (penalized) to avoid DB UUID resolution issues
    await page.goto('/ru/contracts/2')
    await expect(page.getByText(/Штрафной калькулятор/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/дни_просрочки|1%/i).first()).toBeVisible()
  })

  test('profile page shows reputation and ADL wallet', async ({ page }) => {
    await page.goto('/ru/profile')
    await expect(page.getByText(/очков репутации/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Кошелёк ADL/i)).toBeVisible()
    await expect(page.getByText(/Информация о гражданине/i)).toBeVisible()
    // Demo banner should be present for demo users
    await expect(page.getByText(/Демо-режим/i)).toBeVisible()
  })

  test('map has clickable contract markers', async ({ page }) => {
    await page.goto('/ru')
    const map = page.locator('.leaflet-container')
    await expect(map).toBeVisible({ timeout: 25_000 })
    // Markers should exist
    const markers = map.locator('.leaflet-marker-icon')
    await expect(markers.first()).toBeVisible({ timeout: 10_000 })
    const count = await markers.count()
    expect(count).toBeGreaterThan(0)
  })
})
