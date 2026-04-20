import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: '.',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    launchOptions: {
      slowMo: process.env.SLOW_MO ? Number(process.env.SLOW_MO) : undefined,
    },
  },

  projects: [
    {
      name: 'demo',
      use: {
        baseURL: 'http://localhost:4173',
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'test-app',
      use: {
        baseURL: 'http://localhost:5173',
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: [
    // Demo: build then preview
    {
      command: 'npm run build:demo-only && npx vite preview --port 4173',
      cwd: path.join(root, 'demo'),
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'ignore',
    },
    // Test app: Vite dev server
    {
      command: 'npm run dev',
      cwd: path.join(root, 'test-app'),
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'ignore',
    },
    // Test app: Express + WS + MCP server (with Storybook URL for component discovery)
    {
      command: 'node --import tsx ../server/index.ts',
      cwd: path.join(root, 'test-app'),
      url: 'http://localhost:3333/tailwind-config',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'ignore',
      env: { PORT: '3333', STORYBOOK_URL: 'http://localhost:6008' },
    },
    // Storybook v10 (test-app stories) — needed for component discovery in steps 8/9
    {
      command: 'npm run storybook',
      cwd: path.join(root, 'storybook-test', 'v10'),
      url: 'http://localhost:6008',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'ignore',
    },
  ],
});
