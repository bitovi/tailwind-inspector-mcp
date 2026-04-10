import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'overlay+server',
          include: [
            'server/tests/**/*.test.ts',
            'overlay/src/**/*.test.{ts,tsx}',
          ],
          environment: 'node',
          pool: 'forks',
          testTimeout: 30_000,
        },
      },
      './panel/vite.config.ts',
    ],
  },
});
