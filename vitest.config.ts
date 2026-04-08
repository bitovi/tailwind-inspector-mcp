import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'server/tests/**/*.test.ts',
      'overlay/src/**/*.test.{ts,tsx}',
    ],
    environment: 'node',
    pool: 'forks',
    testTimeout: 30_000,
  },
});
