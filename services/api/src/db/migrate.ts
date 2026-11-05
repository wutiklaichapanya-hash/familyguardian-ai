// Applies drizzle migrations from ./drizzle. Usage: pnpm db:migrate (DATABASE_URL from root .env).
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export async function runMigrations(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
  runMigrations(url)
    .then(() => { console.log(`migrations applied to ${new URL(url).pathname.slice(1)}`); })
    .catch((e) => { console.error(e); process.exit(1); });
}
