// QA §9 Safety: crawl every rendered page as each role (th + en) and assert no FORBIDDEN_PHRASES appear.
import { test, expect, type Page } from '@playwright/test';
import { FORBIDDEN_PHRASES } from '../../../packages/shared/src/labels';
import { FAKE_BANK_SMS, SCREENS, loginBrowser, pageText, settle, type Who } from '../helpers';

const MAX_PAGES = 30;

function findForbidden(text: string): string[] {
  const t = text.toLowerCase();
  return FORBIDDEN_PHRASES.filter((p) => t.includes(p.toLowerCase()));
}

async function crawl(page: Page, seeds: string[]) {
  const seen = new Set<string>();
  const queue = [...seeds];
  const hits: string[] = [];
  while (queue.length && seen.size < MAX_PAGES) {
    const p = queue.shift()!;
    if (seen.has(p)) continue;
    seen.add(p);
    await page.goto(p);
    await settle(page);
    const found = findForbidden(await pageText(page));
    if (found.length) hits.push(`${p}: ${found.join(', ')}`);
    const links = await page.$$eval('a[href^="/"]', (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
    for (const l of links) {
      const clean = l.split('#')[0];
      if (!clean || clean.startsWith('/api') || /logout|signout/i.test(clean)) continue;
      if (!seen.has(clean)) queue.push(clean);
    }
  }
  return { hits, visited: [...seen] };
}

for (const locale of ['th', 'en'] as const) {
  for (const role of Object.keys(SCREENS) as (Who | 'anon')[]) {
    test(`forbidden phrases: ${role} (${locale}) crawl`, async ({ page, context }) => {
      await context.addInitScript((l) => { try { localStorage.setItem('fg-locale', l); } catch { /* ignore */ } }, locale);
      if (role !== 'anon') await loginBrowser(context, role);
      const { hits, visited } = await crawl(page, SCREENS[role]);
      test.info().annotations.push({ type: 'visited', description: visited.join(' ') });
      expect(hits).toEqual([]);
    });
  }

  test(`forbidden phrases: senior result screens (${locale})`, async ({ page, context }) => {
    await context.addInitScript((l) => { try { localStorage.setItem('fg-locale', l); } catch { /* ignore */ } }, locale);
    await loginBrowser(context, 'somsri');
    await page.goto('/scam-check');
    await settle(page);
    await page.getByLabel(/ข้อความที่ได้รับ|Message you received/).fill(FAKE_BANK_SMS);
    await page.getByRole('button', { name: /^(ตรวจข้อความ|Check message)$/ }).click();
    await expect(page.getByRole('heading', { name: /ผลการตรวจ|Result/ })).toBeVisible({ timeout: 20_000 });
    expect(findForbidden(await pageText(page))).toEqual([]);

    await page.goto('/help');
    await settle(page);
    await page.getByRole('button', { name: /ส่งคำขอความช่วยเหลือ|Send help request/ }).click();
    await page.waitForTimeout(1500);
    expect(findForbidden(await pageText(page))).toEqual([]);
  });
}
