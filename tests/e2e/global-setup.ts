// Resets the demo database to the seeded synthetic state before the suite runs.
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export default async function globalSetup() {
  // the seed resets sessions, so drop cached cookies from a previous run
  fs.rmSync(path.join(__dirname, '.auth'), { recursive: true, force: true });
  if (process.env.FG_E2E_SKIP_SEED === '1') return;
  const repoRoot = path.resolve(__dirname, '../..');
  execSync('pnpm db:migrate && pnpm db:seed', { cwd: repoRoot, stdio: 'inherit' });
}
