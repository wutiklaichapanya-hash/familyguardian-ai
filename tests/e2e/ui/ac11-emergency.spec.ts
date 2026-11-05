// AC-11 / S-08 / SR-15: the emergency page works logged-out and never claims an agency was told or a case exists.
import { test, expect } from '@playwright/test';
import { pageText, settle } from '../helpers';
import { FORBIDDEN_PHRASES } from '../../../packages/shared/src/labels';

test('AC-11: /emergency is reachable without sign-in and lists 1669 / 191 / 1441 as tel: links', async ({ page }) => {
  await page.goto('/emergency');
  await settle(page);
  await expect(page).toHaveURL(/\/emergency/);
  for (const n of ['1669', '191', '1441']) {
    await expect(page.locator(`a[href="tel:${n}"]`).first(), `tel:${n}`).toBeVisible();
  }
  await expect(page.getByText(/แอปไม่ได้แจ้งหน่วยงานให้อัตโนมัติ|does not notify any agency automatically/).first()).toBeVisible();
  // needs_human_verification entries carry a visible "not yet verified" badge
  await expect(page.getByText(/รอการยืนยันข้อมูล|Awaiting verification|ตรวจสอบเมื่อ|Verified on/).first()).toBeVisible();
});

test('AC-11: no agency acknowledgement, no case number, no dispatch claims — before and after tapping a number', async ({ page }) => {
  await page.goto('/emergency');
  await settle(page);
  await page.evaluate(() => window.addEventListener('click', (e) => {
    if ((e.target as Element | null)?.closest?.('a[href^="tel:"]')) e.preventDefault();
  }));
  const check = async () => {
    const text = await pageText(page);
    for (const p of FORBIDDEN_PHRASES) expect(text.toLowerCase(), `forbidden phrase "${p}"`).not.toContain(p.toLowerCase());
    expect(text).not.toMatch(/(เลขที่|หมายเลข)(รับแจ้ง|เรื่อง|อ้างอิง)|case\s*(no|#|id)|reference\s*(no|number)|ticket/i);
    expect(text).not.toMatch(/ได้รับแจ้งแล้ว|หน่วยงานรับทราบ|ส่งเรื่องแล้ว|agency (has been )?notified|report received|help is on the way/i);
    expect(text).not.toMatch(/[A-Z]{2,}-?\d{5,}/); // case-number-like tokens
  };
  await check();
  await page.locator('a[href="tel:1669"]').first().click();
  await page.waitForTimeout(500);
  await check();
});

test('AC-11: the login page links to the emergency page', async ({ page }) => {
  await page.goto('/login');
  await settle(page);
  await expect(page.locator('a[href="/emergency"]').first()).toBeVisible();
});
