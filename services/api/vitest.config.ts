import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/testDbUrl.ts';

const testUrl = testDatabaseUrl();

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { DATABASE_URL: testUrl, NODE_ENV: 'test', SESSION_SECRET: 'test-only-session-secret-32-characters!!', SANDBOX_WEBHOOK_SECRET: 'test-sandbox-secret', PAYMENTS_MODE: 'sandbox' },
  },
});
