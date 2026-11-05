// AC-9 / S-09 / F-03: the senior revokes in one action on the Privacy screen; Nok loses access.
import { test, expect } from '@playwright/test';
import { API, apiAs, createCheckin, loginBrowser, pageText, resolveIds, restoreSeedGrants, settle } from '../helpers';

test('AC-9: Somsri stops sharing check-ins with Nok; Nok no longer sees check-ins and the API returns 404', async ({ browser }) => {
  const somsriApi = await apiAs('somsri');
  const ids = await resolveIds(somsriApi);
  await restoreSeedGrants(somsriApi, ids);
  await createCheckin(somsriApi, { mood: 'happy', note: 'QA-AC9-NOTE', noteShared: true });

  const nCtx = await browser.newContext();
  await loginBrowser(nCtx, 'nok');
  const n = await nCtx.newPage();
  await n.goto('/family');
  await settle(n);
  await expect(n.getByText(/เช็กอินล่าสุด|Latest check-in/).first()).toBeVisible();

  const sCtx = await browser.newContext();
  await loginBrowser(sCtx, 'somsri');
  const s = await sCtx.newPage();
  try {
    await s.goto('/privacy');
    await settle(s);
    // "who viewed my info" is visible to the senior (S-09)
    await expect(s.getByText(/ใครดูข้อมูลของฉัน|Who viewed my information/).first()).toBeVisible();
    await s.getByRole('button', { name: /(หยุดแชร์.*เช็กอิน.*นก)|(Stop sharing Check-ins with .*Nok)/ }).click();
    // confirm (dialog, possibly with step-up)
    const dialog = s.getByRole('dialog').or(s.getByRole('alertdialog'));
    if (await dialog.count()) {
      const pw = dialog.getByLabel(/รหัสผ่าน|password/i);
      if (await pw.count()) await pw.fill('Demo-Senior-2026');
      await dialog.getByRole('button', { name: /^(ยืนยัน|Confirm|หยุดแชร์|Stop sharing)$/ }).click();
    }
    await expect(s.getByText(/หยุดแชร์.*กับ.*แล้ว|Stopped sharing/).first()).toBeVisible();

    // Nok: next request for that category -> 404; dashboard no longer shows check-ins
    const nokApi = await apiAs('nok');
    expect((await nokApi.get(`${API}/seniors/${ids.somsri}/checkins`)).status()).toBe(404);
    await nokApi.dispose();
    await n.reload();
    await settle(n);
    const text = await pageText(n);
    expect(text).not.toMatch(/เช็กอินล่าสุด|Latest check-in/);
    expect(text).not.toContain('QA-AC9-NOTE');
    // the revoke itself is not announced to Nok (SR-07)
    expect(text).not.toMatch(/ถูกเพิกถอน|ยกเลิกการแชร์|revoked/i);
  } finally {
    await restoreSeedGrants(somsriApi, ids);
    await somsriApi.dispose();
    await sCtx.close(); await nCtx.close();
  }
});
