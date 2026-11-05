// AC-4 / F-01 / F-02 / C-01: each family-side viewer sees only what was granted to them.
import { test, expect } from '@playwright/test';
import { apiAs, createCheckin, loginBrowser, pageText, resolveIds, restoreSeedGrants, settle } from '../helpers';
import { DASHBOARD_LABELS } from '../../../packages/shared/src/labels';

const STATUS_TH = Object.values(DASHBOARD_LABELS).map((l) => l.th);

test.beforeAll(async () => {
  const somsri = await apiAs('somsri');
  const ids = await resolveIds(somsri);
  await restoreSeedGrants(somsri, ids);
  await createCheckin(somsri, { mood: 'happy', note: 'QA-UI-SHARED-NOTE', noteShared: true });
  await createCheckin(somsri, { mood: 'tired', note: 'QA-UI-ONLYME-NOTE', noteShared: true, onlyMe: true });
  await somsri.dispose();
});

test('AC-4: Nok sees Somsri card with an approved status label, the shared check-in, but not the onlyMe one', async ({ page, context }) => {
  await loginBrowser(context, 'nok');
  await page.goto('/family');
  await settle(page);
  await expect(page.getByRole('heading', { name: /ภาพรวมครอบครัว|Family overview/ }).first()).toBeVisible();
  const text = await pageText(page);
  expect(text).toMatch(/สมศรี|Somsri/);
  expect(STATUS_TH.some((s) => text.includes(s)) || /No Action Needed|Check In Recommended|Assistance Requested|Verify Possible Scam/.test(text)).toBe(true);
  expect(text).toMatch(/เช็กอินล่าสุด|Latest check-in/);
  expect(text).not.toContain('QA-UI-ONLYME-NOTE');
  expect(text).not.toMatch(/ยังไม่มีข้อมูลที่แชร์กับคุณ|Nothing shared with you yet/);
});

test("AC-4: Anan (zero grants) sees only the senior's name and 'nothing shared' — no moods, notes or alerts", async ({ page, context }) => {
  await loginBrowser(context, 'anan');
  await page.goto('/family');
  await settle(page);
  const text = await pageText(page);
  expect(text).toMatch(/ยังไม่มีข้อมูลที่แชร์กับคุณ|Nothing shared with you yet|Nothing has been shared with you yet/);
  expect(text).not.toMatch(/QA-UI-|เช็กอินล่าสุด|Latest check-in|ไม่ต้องดำเนินการ|No Action Needed/);
  expect(text).not.toMatch(/มีความสุข|เหนื่อย|Happy|Tired/);
  expect(text).not.toMatch(/อัปเดตล่าสุด \d|Last update \d/);
});

test('AC-4: Pim (caregiver) sees no scam checks, transfer pauses or check-in notes', async ({ page, context }) => {
  await loginBrowser(context, 'pim');
  await page.goto('/family');
  await settle(page);
  const text = await pageText(page);
  expect(text).toMatch(/สมศรี|Somsri/);
  expect(text).not.toMatch(/ข้อความที่ส่งมาให้ช่วยดู|Messages sent to you to check|การหยุดคิดก่อนโอนที่แชร์มา|Transfer pauses shared with you/);
  expect(text).not.toContain('QA-UI-SHARED-NOTE');
  expect(text).not.toMatch(/ช่วยตรวจสอบข้อความ|Verify Possible Scam/);
});

test('AC-4: a family member opening a senior-only screen is not shown senior data', async ({ page, context }) => {
  await loginBrowser(context, 'nok');
  await page.goto('/privacy');
  await settle(page);
  const text = await pageText(page);
  expect(text).not.toMatch(/อนันต์|Anan|พิม|Pim/); // other members' grants never shown to a grantee (SR-06)
});
