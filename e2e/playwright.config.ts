import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// When PW_PROJECT is set (e.g. in CI), only start the servers needed for that project.
const activeProject = process.env.PW_PROJECT as 'demo' | 'test-app' | 'test-app-angular' | undefined;

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
      testMatch: /tutorial(?!-angular).*\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:4173',
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'test-app',
      testMatch: /tutorial(?!-angular).*\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5173',
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'test-app-angular',
      testMatch: /tutorial-angular.*\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5177',
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: [
    // Demo: full build (with Storybook, same as GitHub Pages) then preview
    ...(!activeProject || activeProject === 'demo' ? [{
      command: 'npm run build && npx vite preview --port 4173',
      cwd: path.join(root, 'demo'),
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore' as const,
      stderr: 'ignore' as const,
    }] : []),
    // Test app: Vite dev server
    ...(!activeProject || activeProject === 'test-app' ? [{
      command: 'npm run dev',
      cwd: path.join(root, 'test-app'),
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore' as const,
      stderr: 'ignore' as const,
    }] : []),
    // Test app: Express + WS + MCP server (with Storybook URL for component discovery)
    ...(!activeProject || activeProject === 'test-app' ? [{
      command: 'node --import tsx ../server/index.ts',
      cwd: path.join(root, 'test-app'),
      url: 'http://localhost:3333/tailwind-config',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore' as const,
      stderr: 'ignore' as const,
      env: { PORT: '3333', STORYBOOK_URL: 'http://localhost:6008' },
    }] : []),
    // Storybook v10 (test-app stories) — needed for component discovery in steps 8/9
    ...(!activeProject || activeProject === 'test-app' ? [{
      command: 'npm run storybook',
      cwd: path.join(root, 'storybook-test', 'v10'),
      url: 'http://localhost:6008',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore' as const,
      stderr: 'ignore' as const,
    }] : []),
    // Angular test app: ng serve on port 5177
    ...(!activeProject || activeProject === 'test-app-angular' ? [{
      command: 'npx ng serve --port 5177',
      cwd: path.join(root, 'test-app-angular'),
      url: 'http://localhost:5177',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore' as const,
      stderr: 'ignore' as const,
    }] : []),
    // Angular: Express + WS + MCP server on port 3335
    ...(!activeProject || activeProject === 'test-app-angular' ? [{
      command: 'node --import tsx ../server/index.ts',
      cwd: path.join(root, 'test-app-angular'),
      url: 'http://localhost:3335/tailwind-config',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore' as const,
      stderr: 'ignore' as const,
      env: { PORT: '3335', STORYBOOK_URL: 'http://localhost:6009' },
    }] : []),
    // Storybook v10 (Angular stories) — needed for component discovery in steps 8/9
    ...(!activeProject || activeProject === 'test-app-angular' ? [{
      command: 'npm run storybook',
      cwd: path.join(root, 'storybook-test', 'angular-v10'),
      url: 'http://localhost:6009',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore' as const,
      stderr: 'ignore' as const,
    }] : []),
  ] satisfies PlaywrightTestConfig['webServer'],
});
