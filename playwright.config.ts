import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.browser.spec.ts',
  workers: 1,
  timeout: 75_000,
  use: { baseURL: 'http://127.0.0.1:5182', channel: process.env.BOOKINGS_TEST_BROWSER_CHANNEL || 'msedge', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5182 --strictPort',
    url: 'http://127.0.0.1:5182',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:55440',
      VITE_SUPABASE_ANON_KEY: 'local-test-only',
      VITE_HEXFORGE_SUPABASE_URL: 'http://127.0.0.1:55441',
      VITE_HEXFORGE_SUPABASE_ANON_KEY: 'local-test-only',
      VITE_LOGGING_ENABLED: 'false',
    },
  },
})
