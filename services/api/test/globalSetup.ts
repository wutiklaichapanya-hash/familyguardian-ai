// Creates the SEPARATE test database (default familyguardian_test; see testDbUrl.ts) if missing and migrates it.
import postgres from 'postgres';
import { runMigrations } from '../src/db/migrate';
import { testDatabaseName, testDatabaseUrl } from './testDbUrl';

export default async function setup() {
  const testUrl = testDatabaseUrl();
  const dbName = testDatabaseName(testUrl);
  if (!/^[a-z0-9_]+$/i.test(dbName)) throw new Error(`unsafe test database name: ${dbName}`);
  const admin = new URL(testUrl); admin.pathname = '/postgres';
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    const rows = await sql`select 1 from pg_database where datname = ${dbName}`;
    if (rows.length === 0) await sql.unsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await sql.end({ timeout: 5 });
  }
  await runMigrations(testUrl);
}
