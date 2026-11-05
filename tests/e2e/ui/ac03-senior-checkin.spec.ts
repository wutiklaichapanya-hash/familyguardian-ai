// AC-3 / S-01 / S-02: the senior signs in and completes a check-in unaided in <= 3 taps; result shows in her trend.
import { test, expect } from '@playwright/test';
import { API, apiAs, loginBrowser, loginViaForm, ok, pageText, resolveIds, settle } from '../helpers';
import type { CheckinDTO } from '../../../packages/shared/src/api';

test('AC-3: Somsri signs in, lands on Home (<= 6 main tiles) and checks in within 3 taps', async ({ page }) => {
  await loginViaForm(page, 'somsri');
  await expect(page).toHaveURL(/\/home/);
  await settle(page);

  // S-01: no more than 6 large tiles on Home
  const tiles = page.getByRole('link', { name: /เช็กอินวันนี้|Check in today|โทรหาครอบครัว|Call family|ตรวจข้อความน่าสงสัย|Check a suspicious message|ขอความช่วยเหลือ|Ask for help|ฉุกเฉิน|Emergency/ });
  const tileCount = await tiles.count();
  expect(tileCount).toBeGreaterThanOrEqual(4);
  expect(tileCount).toBeLessThanOrEqual(6);

  // tap 1: the check-in tile
  await page.getByRole('link', { name: /เช็กอินวันนี้|Check in today/ }).first().click();
  await expect(page).toHaveURL(/\/checkin/);
  await expect(page.getByRole('heading', { name: /วันนี้เป็นอย่างไรบ้าง|How are you today/ })).toBeVisible();

  // 6 options incl. "prefer not to answer" with equal weight
  for (const m of [/มีความสุข|Happy/, /ก็ดี|Okay/, /เหงา|Lonely/, /กังวล|Worried/, /เหนื่อย|Tired/, /ไม่อยากตอบ|Prefer not to answer/]) {
    await expect(page.getByRole('radio', { name: m })).toBeVisible();
  }
  // tap 2: choose a mood. tap 3: save.
  await page.getByRole('radio', { name: /ก็ดี|Okay/ }).check();
  await page.getByRole('button', { name: /บันทึกเช็กอิน|Save check-in/ }).click();

  await expect(page.getByRole('status').filter({ hasText: /บันทึก(เช็กอิน)?แล้ว|saved/i }).first()).toBeVisible();
  const text = await pageText(page);
  expect(text).not.toMatch(/คะแนนอารมณ์|mood score|ซึมเศร้า|depression/i);
});

test('AC-3: the saved check-in appears in the senior trend; gaps show "no data", not decline', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/checkin');
  await settle(page);
  await expect(page.getByRole('heading', { name: /บันทึกของฉัน|ประวัติการเช็กอินของฉัน|My (last 14 days|check-in history)/ })).toBeVisible();
  const text = await pageText(page);
  expect(text).toMatch(/ก็ดี|Okay|มีความสุข|Happy|เหงา|กังวล|เหนื่อย|ไม่อยากตอบ/);
  expect(text).not.toMatch(/ลดลง|แย่ลง|decline|dropped|worse/i);
  // the seed has days without a check-in: they must be labelled neutrally (S-03)
  expect(text).toMatch(/ไม่มีข้อมูล|ยังไม่ได้บันทึก|No data|Not recorded/);
});

test('AC-3: "only me" option exists and confirms it is kept private', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/checkin');
  await settle(page);
  await page.getByRole('radio', { name: /ไม่อยากตอบ|Prefer not to answer/ }).check();
  // v0.3 UI: explicit audience radio group; "only me" is a radio, not a checkbox
  await page.getByRole('group', { name: /ใครดูเช็กอินนี้ได้|Who can see this check-in/ }).getByRole('radio', { name: /^(เฉพาะฉัน|Only me)/ }).check();
  await page.getByRole('button', { name: /บันทึกเช็กอิน|Save check-in/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /บันทึก(เช็กอิน)?แล้ว|saved/i }).first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /เฉพาะฉัน|only me|kept for you only/i }).first()).toBeVisible();
});

test('AC-3/AC-4 (v0.3 audience choice): one audience is pre-selected, "share" names the recipients, and a shared check-in reaches Nok', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/checkin');
  await settle(page);
  const group = page.getByRole('group', { name: /ใครดูเช็กอินนี้ได้|Who can see this check-in/ });
  const radios = group.getByRole('radio');
  expect(await radios.count()).toBeGreaterThanOrEqual(2);
  const checked = await group.locator('input[type="radio"]:checked').count();
  expect(checked, 'exactly one audience is selected before saving').toBe(1);
  const share = group.getByRole('radio', { name: /แชร์กับคนที่ได้รับสิทธิ์|Share with people who have/ });
  await expect(share).toBeEnabled();
  await expect(group).toContainText(/นก|Nok/); // the audience is named before saving
  await page.getByRole('radio', { name: /^(มีความสุข|Happy)$/ }).check();
  await share.check();
  await page.getByRole('button', { name: /บันทึกเช็กอิน|Save check-in/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /บันทึก(เช็กอิน)?แล้ว|saved/i }).first()).toBeVisible();

  const somsri = await apiAs('somsri');
  const ids = await resolveIds(somsri);
  const own = await ok<CheckinDTO[]>(await somsri.get(`${API}/me/checkins?days=1`));
  const newest = own.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  expect(newest.onlyMe).toBe(false);
  const nok = await apiAs('nok');
  const shared = await ok<{ id: string }[]>(await nok.get(`${API}/seniors/${ids.somsri}/checkins?days=1`));
  expect(shared.map((x) => x.id)).toContain(newest.id);
  await somsri.dispose(); await nok.dispose();
});
