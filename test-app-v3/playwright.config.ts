import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for E2E Tests (Tailwind v3 test app)
 */
export default defineConfig({
  testDir: './e2e',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
  ],

  webServer: [
    {
      command: 'npx vite --port 5175',
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'node --import tsx ../server/index.ts',
      url: 'http://localhost:3334/tailwind-config',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        PORT: '3334',
      },
    },
  ],
});
