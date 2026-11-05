// AC-7 / S-06: contact tile is an <a href="tel:..."> and the log says "call started", never "connected".
import { test, expect } from '@playwright/test';
import { API, apiAs, loginBrowser, ok, pageText, settle } from '../helpers';

test('AC-7: tapping a trusted contact opens tel: and logs "call started from app"', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/contacts');
  await settle(page);
  const telLinks = page.locator('main a[href^="tel:"]');
  await expect(telLinks.first()).toBeVisible();
  const href = await telLinks.first().getAttribute('href');
  expect(href).toMatch(/^tel:[0-9+\-]+$/);
  // the accessible name names the person
  await expect(page.getByRole('link', { name: /โทรหา|Call/ }).first()).toBeVisible();

  // Keep the page from leaving for the OS dialer; the app's own click handler still runs first.
  await page.evaluate(() => window.addEventListener('click', (e) => {
    if ((e.target as Element | null)?.closest?.('a[href^="tel:"]')) e.preventDefault();
  }));
  await telLinks.first().click();

  await expect(page.getByText(/เริ่มโทรจากแอป|Call started from app|เปิดหน้าโทรออกแล้ว|ขอเปิดแอปโทรศัพท์|Asked your phone app to call/).first()).toBeVisible();
  const text = await pageText(page);
  expect(text).not.toMatch(/call connected|connected|สายเชื่อมต่อแล้ว|โทรสำเร็จ|call completed/i);

  const somsri = await apiAs('somsri');
  const logs = await ok<{ kind: string; label: string; createdAt: string }[]>(await somsri.get(`${API}/me/action-logs`));
  const latest = logs.filter((l) => l.kind === 'call_started_from_app').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  expect(latest, 'call_started_from_app logged').toBeTruthy();
  expect(Date.now() - new Date(latest.createdAt).getTime()).toBeLessThan(5 * 60_000);
  await somsri.dispose();
});

test('AC-7: phone numbers in the contact list never claim a call outcome', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/contacts');
  await settle(page);
  const text = await pageText(page);
  expect(text).not.toMatch(/รับสายแล้ว|answered|connected/i);
});
