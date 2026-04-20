import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for E2E Tests
 */
export default defineConfig({
  testDir: './e2e',

  /* The suite shares a single in-memory patch queue in the dev server. */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Keep queue-driven tests deterministic locally and in CI. */
  workers: 1,

  /* Reporter to use. */
  reporter: 'html',

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Run headless */
    headless: true,
  },

  /* Configure projects for Chrome Desktop only */
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

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'node --import tsx ../server/index.ts',
      url: 'http://localhost:3333/tailwind-config',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        PORT: '3333',
        STORYBOOK_URL: 'http://localhost:6008',
      },
    },
    // Storybook v10 — needed for component discovery in flow-a/flow-b tests
    {
      command: 'npm run storybook',
      cwd: '../storybook-test/v10',
      url: 'http://localhost:6008',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
