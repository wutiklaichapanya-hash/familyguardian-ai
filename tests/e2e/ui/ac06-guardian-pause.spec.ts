// AC-6 / S-05: Guardian Pause ฿80,000 to an unknown recipient under pressure -> stop and verify; no bank connection.
import { test, expect } from '@playwright/test';
import { loginBrowser, pageText, settle } from '../helpers';

const YES = /^(ใช่|Yes)$/;
const NO = /^(ไม่ใช่|No)$/;

test('AC-6: ฿80,000 unknown recipient -> Stop and verify, with "no bank connection" note and actions', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/guardian-pause');
  await settle(page);
  // the "no bank connection" note is visible before and after
  await expect(page.getByText(/ไม่ได้เชื่อมต่อหรือระงับการโอนเงินในธนาคาร|does not link to, or stop, transfers at your bank/).first()).toBeVisible();

  await page.getByLabel(/จำนวนเงินที่จะโอน|Amount to transfer/).fill('80000');
  await page.getByRole('group', { name: /รู้จักผู้รับเงิน|know the recipient/ }).getByRole('radio', { name: NO }).check();
  await page.getByRole('group', { name: /เร่งให้คุณโอน|pushing you to transfer/ }).getByRole('radio', { name: YES }).check();
  await page.getByRole('group', { name: /ความลับ|secret/ }).getByRole('radio', { name: YES }).check();
  await page.getByRole('group', { name: /ตรวจสอบเอง|checked it yourself/ }).getByRole('radio', { name: NO }).check();
  await page.getByRole('button', { name: /^(ดูผล|See result)$/ }).click();

  await expect(page.getByText(/หยุดก่อน และตรวจสอบให้แน่ใจ|Stop first and make sure/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/หยุดและตรวจสอบ|Stop and verify/).first()).toBeVisible();
  await expect(page.getByText(/ไม่ได้เชื่อมต่อหรือระงับการโอนเงินในธนาคาร|does not link to, or stop, transfers at your bank/).first()).toBeVisible();
  // the four actions: stop & verify, call someone you trust, bank (verified directory), 1441
  await expect(page.getByText(/โทรหาคนที่คุณไว้ใจ|Call someone you trust/).first()).toBeVisible();
  await expect(page.locator('a[href^="tel:1441"]').first()).toBeVisible();
  const text = await pageText(page);
  expect(text).toMatch(/80,000|80000/);
  // never imply the transfer was blocked, never "safe"
  expect(text).not.toMatch(/ระงับการโอนแล้ว|บล็อกการโอนแล้ว|transfer (was )?blocked|transfer stopped/i);
  expect(text).not.toMatch(/ปลอดภัยแน่นอน|definitely safe/i);
  // SR-10: never assumes family is safe
  expect(text).not.toMatch(/ครอบครัวปลอดภัย|family is safe/i);
});
