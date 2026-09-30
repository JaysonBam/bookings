import { defineConfig, devices } from '@playwright/test'

const backend = `http://127.0.0.1:${process.env.BOOKINGS_TEST_API_PORT || 55439}`
const app = `http://127.0.0.1:${process.env.BOOKINGS_TEST_SITE_PORT || 5175}`

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  workers: 1,
  use: { baseURL: app, channel: 'msedge', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    { command: 'node tests/helpers/testServer.ts', url: `${backend}/health`, timeout: 30000 },
    { command: 'node tests/helpers/browserSite.ts', url: app,
      timeout: 180000, env: { VITE_SUPABASE_URL:backend,VITE_SUPABASE_ANON_KEY:'test-public-key',
        VITE_HEXFORGE_SUPABASE_URL:backend,VITE_HEXFORGE_SUPABASE_ANON_KEY:'test-public-key' } },
  ],
})
