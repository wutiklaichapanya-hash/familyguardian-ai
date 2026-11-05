// AC-5 / S-04: a scam warning is understandable; never a "safe" verdict.
import { test, expect, type Page } from '@playwright/test';
import { FAKE_BANK_SMS, loginBrowser, settle } from '../helpers';
import { RISK_LABELS } from '../../../packages/shared/src/labels';

async function check(page: Page, text: string) {
  await page.goto('/scam-check');
  await settle(page);
  await page.getByLabel(/ข้อความที่ได้รับ|Message you received/).fill(text);
  await page.getByRole('button', { name: /^(ตรวจข้อความ|Check message)$/ }).click();
  await expect(page.getByRole('heading', { name: /ผลการตรวจ|Result/ })).toBeVisible({ timeout: 20_000 });
}

/** Text of the result area: everything from the "Result" heading to the end of main. */
async function resultText(page: Page) {
  return page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('h1,h2,h3')).find((e) => /ผลการตรวจ|Result/.test(e.textContent ?? ''));
    const box = h?.closest('section,article,div.card,[role="region"]') ?? h?.parentElement ?? document.body;
    return (box as HTMLElement).innerText;
  });
}

test.beforeEach(async ({ context }) => { await loginBrowser(context, 'somsri'); });

test('AC-5: Thai fake-bank SMS -> caution/high risk with reasons, uncertainty, steps, ask family, call 1441', async ({ page }) => {
  await check(page, FAKE_BANK_SMS);
  const r = await resultText(page);
  const risky = [RISK_LABELS.high_risk.th, RISK_LABELS.caution.th, RISK_LABELS.high_risk.en, RISK_LABELS.caution.en];
  expect(risky.some((l) => r.includes(l)), `result shows caution/high risk label. Got:\n${r.slice(0, 800)}`).toBe(true);
  await expect(page.getByText(/ทำไมถึงคิดแบบนี้|Why we think so/)).toBeVisible();
  await expect(page.getByText(/สิ่งที่เรายังไม่แน่ใจ|What we are not sure about/)).toBeVisible();
  await expect(page.getByText(/สิ่งที่ควรทำต่อ|What to do next/)).toBeVisible();
  // at least one plain-language reason (signal label) is shown
  expect(r).toMatch(/แอบอ้าง|เร่ง|OTP|รหัส|ลิงก์|Pretends|quickly|OTP|link/i);
  // "ask family" and "call 1441"
  await expect(page.getByRole('button', { name: /ส่งให้ครอบครัวช่วยดู|Ask family to take a look/ }).or(page.getByRole('link', { name: /ส่งให้ครอบครัวช่วยดู|Ask family/ })).first()).toBeVisible();
  await expect(page.locator('a[href^="tel:1441"]').first()).toBeVisible();
  // "ปลอดภัย" (safe) is never part of the verdict
  expect(r).not.toContain('ปลอดภัย');
  expect(r.toLowerCase()).not.toMatch(/\bsafe\b/);
  // SR-18: the scam link is not rendered as a clickable link
  expect(await page.locator('a[href*="kbank-verify"]').count()).toBe(0);
});

test('AC-5: a benign message never gets a "safe" verdict — lowest wording still says verify', async ({ page }) => {
  await check(page, 'แม่คะ พรุ่งนี้หนูจะไปหาตอนเย็น กินข้าวด้วยกันนะคะ');
  const r = await resultText(page);
  expect(r).not.toContain('ปลอดภัย');
  expect(r.toLowerCase()).not.toMatch(/\bsafe\b/);
  const allowed = Object.values(RISK_LABELS).flatMap((l) => [l.th, l.en]);
  expect(allowed.some((l) => r.includes(l)), `one of the approved risk labels. Got:\n${r.slice(0, 500)}`).toBe(true);
});

test('AC-5: empty submission explains what to enter', async ({ page }) => {
  await page.goto('/scam-check');
  await settle(page);
  await page.getByRole('button', { name: /^(ตรวจข้อความ|Check message)$/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: /กรุณา|Please/ }).first()).toBeVisible();
});
