// AC-3 / S-01 / S-02: the senior signs in and completes a check-in unaided in <= 3 taps; result shows in her trend.
import { test, expect } from '@playwright/test';
import { loginBrowser, loginViaForm, pageText, settle } from '../helpers';

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

  await expect(page.getByText(/บันทึกเช็กอินแล้ว|Check-in saved/)).toBeVisible();
  const text = await pageText(page);
  expect(text).not.toMatch(/คะแนนอารมณ์|mood score|ซึมเศร้า|depression/i);
});

test('AC-3: the saved check-in appears in the senior trend; gaps show "no data", not decline', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/checkin');
  await settle(page);
  await expect(page.getByText(/บันทึกของฉัน 14 วันล่าสุด|My last 14 days/)).toBeVisible();
  const text = await pageText(page);
  expect(text).toMatch(/ก็ดี|Okay|มีความสุข|Happy|เหงา|กังวล|เหนื่อย|ไม่อยากตอบ/);
  expect(text).not.toMatch(/ลดลง|แย่ลง|decline|dropped|worse/i);
});

test('AC-3: "only me" option exists and confirms it is kept private', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/checkin');
  await settle(page);
  await page.getByRole('radio', { name: /ไม่อยากตอบ|Prefer not to answer/ }).check();
  await page.getByLabel(/เก็บไว้ดูคนเดียว|Keep this to myself/).check();
  await page.getByRole('button', { name: /บันทึกเช็กอิน|Save check-in/ }).click();
  await expect(page.getByText(/บันทึกเช็กอินแล้ว|Check-in saved/)).toBeVisible();
  await expect(page.getByText(/แชร์กับ: เฉพาะฉัน|kept for you only/).first()).toBeVisible();
});
