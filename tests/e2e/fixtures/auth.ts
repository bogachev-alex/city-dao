import type { Page } from '@playwright/test'

/** Demo auth payloads (same keys as app `lib/auth.ts` localStorage) */
export const AUTH_JSON = {
  contractor: JSON.stringify({
    role: 'CONTRACTOR',
    id: 'demo-contractor-1',
    name: 'ТОО СтройАлматы',
  }),
  akimat: JSON.stringify({
    role: 'AKIMAT',
    id: 'demo-akimat-1',
    name: 'Сотрудник акимата',
  }),
  citizen: JSON.stringify({
    role: 'CITIZEN',
    id: 'demo-citizen-1',
    name: 'Демо гражданин',
  }),
} as const

export async function seedLocalStorageAuth(page: Page, json: string) {
  await page.goto('/ru/login')
  await page.evaluate((payload) => {
    localStorage.setItem('amanat_auth', payload)
    localStorage.setItem('onboarding_completed', 'true')
  }, json)
}
