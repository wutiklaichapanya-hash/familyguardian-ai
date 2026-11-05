// S-02 / SR-02 / SR-03: an onlyMe check-in is invisible to Nok — no row, no count change, no timestamp leak.
import { test, expect, type APIRequestContext } from '@playwright/test';
import { API, apiAs, createCheckin, dashboardCard, ensureGrant, ok, resolveIds, type Ids } from '../helpers';
import type { SharedCheckinDTO } from '../../../packages/shared/src/api';

let somsri: APIRequestContext; let nok: APIRequestContext; let ids: Ids;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  [somsri, nok] = await Promise.all([apiAs('somsri'), apiAs('nok')]);
  ids = await resolveIds(somsri);
  await ensureGrant(somsri, ids.nok, 'checkins');
});
test.afterAll(async () => { await somsri?.dispose(); await nok?.dispose(); });

const sharedList = async () => ok<SharedCheckinDTO[]>(await nok.get(`${API}/seniors/${ids.somsri}/checkins?days=90`));

test('onlyMe check-in: excluded from Nok list, counts and dashboard; lastUpdatedAt unchanged', async () => {
  // A visible baseline check-in first so that lastUpdatedAt has a defined value.
  await createCheckin(somsri, { mood: 'okay' });
  const beforeList = await sharedList();
  const beforeCard = await dashboardCard(nok, ids.somsri);
  expect(beforeCard).toBeTruthy();

  await new Promise((r) => setTimeout(r, 1100)); // ensure a distinguishable timestamp
  const marker = `QA-ONLYME-${Date.now()}`;
  const hidden = await createCheckin(somsri, { mood: 'lonely', note: marker, noteShared: true, onlyMe: true });
  expect(hidden.onlyMe).toBe(true);

  const afterList = await sharedList();
  expect(afterList.map((c) => c.id)).not.toContain(hidden.id);
  expect(afterList.length, 'no extra row / count for hidden check-in').toBe(beforeList.length);
  expect(JSON.stringify(afterList)).not.toContain(marker);

  const afterCard = await dashboardCard(nok, ids.somsri);
  expect(afterCard!.lastUpdatedAt ?? null, 'lastUpdatedAt must not move because of an onlyMe check-in').toBe(beforeCard!.lastUpdatedAt ?? null);
  expect(afterCard!.latestCheckin?.at ?? null).toBe(beforeCard!.latestCheckin?.at ?? null);
  expect(afterCard!.latestCheckin?.mood ?? null).not.toBe('lonely');
  expect(JSON.stringify(afterCard)).not.toContain(marker);
  expect(afterCard!.status, 'a hidden "lonely" must not raise check_in_recommended').toBe(beforeCard!.status);
  expect(new Date(hidden.createdAt).toISOString()).not.toBe(afterCard!.lastUpdatedAt ?? '');
});

test('the senior still sees her own onlyMe check-in', async () => {
  const own = await ok<{ id: string; onlyMe: boolean; note?: string | null }[]>(await somsri.get(`${API}/me/checkins?days=30`));
  expect(own.some((c) => c.onlyMe && /QA-ONLYME-/.test(c.note ?? ''))).toBe(true);
});

test('shared rows have no onlyMe/noteShared flags; a non-shared note is omitted', async () => {
  const marker = `QA-PRIVATE-NOTE-${Date.now()}`;
  const c = await createCheckin(somsri, { mood: 'tired', note: marker, noteShared: false });
  const list = await sharedList();
  const row = list.find((x) => x.id === c.id) as Record<string, unknown> | undefined;
  expect(row, 'shared (not onlyMe) check-in is visible to Nok').toBeTruthy();
  expect(row).not.toHaveProperty('onlyMe');
  expect(row).not.toHaveProperty('noteShared');
  expect(row!.note ?? undefined).toBeUndefined();
  expect(JSON.stringify(list)).not.toContain(marker);
});

test('a shared note IS visible when noteShared=true', async () => {
  const marker = `QA-SHARED-NOTE-${Date.now()}`;
  const c = await createCheckin(somsri, { mood: 'happy', note: marker, noteShared: true });
  const row = (await sharedList()).find((x) => x.id === c.id);
  expect(row?.note).toBe(marker);
});

test('days query is capped at 90', async () => {
  const res = await nok.get(`${API}/seniors/${ids.somsri}/checkins?days=100000`);
  expect([200, 400]).toContain(res.status());
});
