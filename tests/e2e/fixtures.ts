import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Default Next dev + RSC: `load` may never fire in time; DOM is enough for assertions */
function patchGoto(page: Page) {
  const orig = page.goto.bind(page)
  page.goto = (url, options) =>
    orig(url, { waitUntil: 'domcontentloaded', ...options })
}

export const test = base.extend({
  page: async ({ page }, use) => {
    patchGoto(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
