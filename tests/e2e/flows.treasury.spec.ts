import { test, expect } from './fixtures'

test.describe('Treasury E2E flows', () => {
  test('treasury page loads with district data', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.getByText(/Ауэзовский район/i)).toBeVisible()
    // Balance card
    await expect(page.getByText(/Баланс казны района/i)).toBeVisible({ timeout: 15_000 })
    // Penalties section
    await expect(page.getByText(/Штрафы подрядчиков/i)).toBeVisible()
    // Proposals section
    await expect(page.getByText(/Предложения по расходам/i)).toBeVisible()
  })

  test('district switcher navigates correctly', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    await expect(page.getByText(/Ауэзовский район/i)).toBeVisible()

    // Click another district
    await page.getByRole('link', { name: 'Медеуский' }).click()
    await page.waitForURL(/treasury.*%D0%9C%D0%B5%D0%B4%D0%B5%D1%83%D1%81%D0%BA%D0%B8%D0%B9|treasury.*Медеуский/)
    await expect(page.getByText(/Медеуский район/i)).toBeVisible()
  })

  test('penalty list shows fine details', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    // Wait for penalty data to load
    const penaltySection = page.getByText(/Штрафы подрядчиков/i)
    await expect(penaltySection).toBeVisible({ timeout: 15_000 })

    // Check for penalty type labels (from demo data)
    const penalties = page.locator('text=/Просрочка|Брак|Брошенный/i')
    const count = await penalties.count()
    expect(count).toBeGreaterThan(0)
  })

  test('proposals have AI analysis button', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    // Scroll to proposals
    const proposals = page.getByText(/Предложения по расходам/i)
    await expect(proposals).toBeVisible({ timeout: 15_000 })
    await proposals.scrollIntoViewIfNeeded()

    // AI Analysis button exists on at least one proposal
    const aiButton = page.getByText(/AI Анализ/i).first()
    await expect(aiButton).toBeVisible()
  })

  test('all 8 Almaty districts are shown', async ({ page }) => {
    await page.goto('/ru/treasury/' + encodeURIComponent('Ауэзовский'))
    const districts = [
      'Алатауский', 'Алмалинский', 'Ауэзовский', 'Бостандыкский',
      'Жетысуский', 'Медеуский', 'Наурызбайский', 'Турксибский',
    ]
    for (const d of districts) {
      await expect(page.getByRole('link', { name: d })).toBeVisible()
    }
  })
})
