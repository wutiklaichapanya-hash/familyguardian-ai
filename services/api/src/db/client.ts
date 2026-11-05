import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export function createDb(url: string, opts: { max?: number } = {}) {
  const sql = postgres(url, { max: opts.max ?? 10, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}
export type Db = ReturnType<typeof createDb>['db'];
/** A transaction handle or the db itself. */
export type Tx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];
