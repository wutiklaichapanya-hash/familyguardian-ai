// Which database the API tests use. Never the main dev DB:
// - if DATABASE_URL already names a database containing "test" (e.g. familyguardian_test_v03), use it as-is;
// - otherwise use `familyguardian_test` on the same server.
export function testDatabaseUrl(base = process.env.DATABASE_URL ?? 'postgres://fg:fg_local_only@localhost:5433/familyguardian'): string {
  const u = new URL(base);
  const name = u.pathname.replace(/^\//, '');
  if (!/test/i.test(name)) u.pathname = '/familyguardian_test';
  return u.toString();
}
export const testDatabaseName = (url: string) => new URL(url).pathname.replace(/^\//, '');
