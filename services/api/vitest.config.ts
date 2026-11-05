import { defineConfig } from 'vitest/config';

const base = process.env.DATABASE_URL ?? 'postgres://fg:fg_local_only@localhost:5433/familyguardian';
const testUrl = (() => { const u = new URL(base); u.pathname = '/familyguardian_test'; return u.toString(); })();

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
