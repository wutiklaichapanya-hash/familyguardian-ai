// Creates the SEPARATE test database (familyguardian_test) if missing and migrates it.
import postgres from 'postgres';
import { runMigrations } from '../src/db/migrate';

export default async function setup() {
  const base = process.env.DATABASE_URL ?? 'postgres://fg:fg_local_only@localhost:5433/familyguardian';
  const admin = new URL(base); admin.pathname = '/postgres';
  const test = new URL(base); test.pathname = '/familyguardian_test';
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    const rows = await sql`select 1 from pg_database where datname = 'familyguardian_test'`;
    if (rows.length === 0) await sql.unsafe('CREATE DATABASE familyguardian_test');
  } finally {
    await sql.end({ timeout: 5 });
  }
  await runMigrations(test.toString());
}
