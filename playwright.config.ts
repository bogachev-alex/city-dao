import { defineConfig, devices } from '@playwright/test'
import path from 'path'

/**
 * E2E for AI agents: traces + HTML report + custom markdown summary.
 * Run: npm run test:e2e  (starts dev server unless PORT busy / CI)
 */
export default defineConfig({
  testDir: path.join(__dirname, 'tests/e2e'),
  /** Dev server cold-compiles routes; serial runs reduce compile contention and timeouts */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  /** First navigation to a route can exceed 30s while Next compiles */
  timeout: 120_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['./tests/e2e/reporters/ai-summary-reporter.ts'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ru-RU',
    actionTimeout: 15_000,
    navigationTimeout: 90_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
