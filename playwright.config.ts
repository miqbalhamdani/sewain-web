import { defineConfig, devices } from '@playwright/test'

import { appURL } from './e2e/support'

/**
 * End-to-end suites.  (S1-070, S1-071)
 *
 * They run against the whole stack the way production serves it: the backoffice
 * on app.<apex> and the public page on <slug>.<apex>, both through Caddy (the
 * local Caddyfile.dev in sewain-api), with the API, the worker, Mailpit and a
 * database already up. Nothing here starts servers -- see CLAUDE.md "E2E".
 */
export default defineConfig({
  testDir: './e2e',
  // One stack, one database: specs share it, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: appURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
