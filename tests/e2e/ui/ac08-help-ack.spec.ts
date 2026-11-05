// AC-8 / S-07 / F-04 / SR-12: help request -> Nok acknowledges -> Somsri sees the acknowledgement.
import { test, expect } from '@playwright/test';
import { API, apiAs, loginBrowser, ok, pageText, resolveIds, restoreSeedGrants, revokeGrant, settle } from '../helpers';
import type { AlertDTO } from '../../../packages/shared/src/api';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const somsri = await apiAs('somsri');
  await restoreSeedGrants(somsri, await resolveIds(somsri));
  await somsri.dispose();
});

test('AC-8: Somsri asks for help, Nok acknowledges, Somsri sees "Nok acknowledged"', async ({ browser }) => {
  const sCtx = await browser.newContext();
  const nCtx = await browser.newContext();
  await loginBrowser(sCtx, 'somsri');
  await loginBrowser(nCtx, 'nok');
  const s = await sCtx.newPage();
  const n = await nCtx.newPage();

  await s.goto('/help');
  await settle(s);
  await expect(s.getByText(/ไม่มีการแจ้งหน่วยงาน|No agency is notified|ไม่ได้แจ้งหน่วยงาน/).first()).toBeVisible();
  await s.getByRole('button', { name: /ส่งคำขอความช่วยเหลือ|Send help request/ }).click();
  // real delivery states, naming the recipient
  await expect(s.getByText(/(รอส่งถึง|ส่งการแจ้งเตือนถึง|จำลองการส่งถึง|เปิดดูแล้ว).*นก|(Waiting to send to|Alert sent to|Simulated delivery to).*Nok|Nok has seen it/).first()).toBeVisible({ timeout: 20_000 });
  await expect(s.getByText(/ยังไม่มีใคร(กด)?รับทราบ|Nobody has (acknowledged|pressed Acknowledge) yet/).first()).toBeVisible();
  const before = await pageText(s);
  expect(before).not.toMatch(/(นก|Nok).{0,5}(รับทราบแล้ว|acknowledged)/);

  // Nok opens the alert (id from her own recipient list) and presses "รับทราบ"
  const nokApi = await apiAs('nok');
  const alerts = await ok<AlertDTO[]>(await nokApi.get(`${API}/alerts`));
  const latest = alerts.filter((a) => a.kind === 'user_requested_help').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  expect(latest, 'Nok received the help alert').toBeTruthy();
  await nokApi.dispose();
  await n.goto('/family');
  await settle(n);
  await expect(n.getByText(/ขอความช่วยเหลือ|Assistance Requested|Asked for help/).first()).toBeVisible();
  await n.goto(`/alerts/${latest.id}`);
  await settle(n);
  await expect(n.getByText(/กดขอเองจากแอป|กดปุ่มในแอป|pressed the button in the app/).first()).toBeVisible();
  await n.getByRole('button', { name: /^(รับทราบ|Acknowledge)$/ }).click();
  await expect(n.getByText(/รับทราบแล้ว|acknowledged/).first()).toBeVisible();

  // Somsri's help page refreshes every 5 s; reload as a fallback
  await expect(async () => {
    await s.reload();
    await settle(s);
    await expect(s.getByText(/(นก|Nok)[^\n]{0,20}(รับทราบแล้ว|acknowledged|pressed Acknowledge)/).first()).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  const after = await pageText(s);
  expect(after).not.toMatch(/กำลังมาช่วย|help is coming|on the way|กำลังไป/i);
  await sCtx.close(); await nCtx.close();
});

test('AC-8 / SR-12: with no one set up to receive help, the UI says so and shows 1669 — never "sent"', async ({ page, context }) => {
  const somsri = await apiAs('somsri');
  const ids = await resolveIds(somsri);
  await revokeGrant(somsri, ids.nok, 'help_requests');
  await revokeGrant(somsri, ids.pim, 'help_requests');
  try {
    await loginBrowser(context, 'somsri');
    await page.goto('/help');
    await settle(page);
    await page.getByRole('button', { name: /ส่งคำขอความช่วยเหลือ|Send help request/ }).click();
    await expect(page.getByText(/ยังไม่มีใครถูกตั้งให้รับคำขอนี้|ยังไม่ได้ส่งถึงใคร|No one is set up to receive this request|has not gone to anyone/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('a[href^="tel:1669"]').first()).toBeVisible();
    const text = await pageText(page);
    // the static intro says "sends a notification to people you trust"; a delivery state would read "ส่งการแจ้งเตือนถึง <name> แล้ว"
    expect(text).not.toMatch(/ส่งการแจ้งเตือนถึง[^\n]*แล้ว|Alert sent to|ส่งแล้ว/);
  } finally {
    await restoreSeedGrants(somsri, ids);
    await somsri.dispose();
  }
});
