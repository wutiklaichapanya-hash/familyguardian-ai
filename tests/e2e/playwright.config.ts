// FamilyGuardian AI — independent QA E2E suite (owned by the QA agent).
// Run from the repo root: `pnpm test:e2e`  (= playwright test -c tests/e2e/playwright.config.ts)
// Tests are written against the CONTRACT (packages/shared/src/api.ts v0.2) and the acceptance
// criteria in docs/product/01_DISCOVERY_AND_SCOPE.md §4 — not against the implementation.
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  testDir: __dirname,
  testMatch: ['api/**/*.spec.ts', 'ui/**/*.spec.ts', 'a11y/**/*.spec.ts', 'safety/**/*.spec.ts'],
  // The suite shares one seeded database and several specs change grants (and restore them),
  // so run serially for deterministic results.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  outputDir: path.join(__dirname, 'test-results'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(__dirname, 'test-results', 'results.json') }],
    ['html', { outputFolder: path.join(__dirname, 'playwright-report'), open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Default per the root scripts. FG_E2E_API_CMD lets QA run without watch mode (e.g. `pnpm --filter @fg/api start`)
      // so concurrent source edits by other agents don't restart the API mid-run.
      command: process.env.FG_E2E_API_CMD ?? 'pnpm dev:api',
      cwd: repoRoot,
      // The global limit (300 req/min/IP) is meant for people, not a serial E2E suite on one IP. The LOGIN limit
      // (5/min per IP+email) is left at its default; the suite re-uses sessions instead (see helpers.ts).
      env: { RATE_LIMIT_GLOBAL_MAX: process.env.RATE_LIMIT_GLOBAL_MAX ?? '5000' },
      url: 'http://localhost:4100/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm dev:web',
      cwd: repoRoot,
      url: 'http://localhost:3100',
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
