// S-02 "works by keyboard" + WCAG 1.4.10 reflow: keyboard-only check-in, visible focus, 320 px without horizontal scroll.
import { test, expect, type Page } from '@playwright/test';
import { SCREENS, loginBrowser, settle, type Who } from '../helpers';

async function tabUntil(page: Page, pred: string, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    // eslint-disable-next-line no-new-func
    const hit = await page.evaluate((src) => new Function('el', `return (${src})(el)`)(document.activeElement), pred);
    if (hit) return true;
  }
  return false;
}

test('keyboard only: Somsri completes a check-in with Tab / Space / Enter, focus is always visible', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/checkin');
  await settle(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => undefined);

  const reachedMood = await tabUntil(page, `(el) => el && el.type === 'radio'`);
  expect(reachedMood, 'a mood radio is reachable by Tab').toBe(true);
  const focusVisible = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const target = (el.closest('label') as HTMLElement | null) ?? el;
    const cs = [getComputedStyle(el), getComputedStyle(target)];
    return cs.some((c) => (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || c.boxShadow !== 'none');
  });
  expect(focusVisible, 'focused control has a visible focus indicator').toBe(true);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).checked)).toBe(true);

  const reachedSubmit = await tabUntil(page, `(el) => el && el.tagName === 'BUTTON' && el.type === 'submit'`);
  expect(reachedSubmit, 'the save button is reachable by Tab').toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: /บันทึก(เช็กอิน)?แล้ว|saved/i }).first()).toBeVisible();
});

test('skip link is the first focusable element on the senior home', async ({ page, context }) => {
  await loginBrowser(context, 'somsri');
  await page.goto('/home');
  await settle(page);
  await page.keyboard.press('Tab');
  const name = await page.evaluate(() => (document.activeElement as HTMLElement)?.innerText ?? '');
  expect(name).toMatch(/ข้าม|Skip/);
});

test.describe('320 px viewport: no horizontal scroll', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const role of ['anon', 'somsri', 'nok'] as (Who | 'anon')[]) {
    for (const p of SCREENS[role]) {
      test(`320px ${role} ${p}`, async ({ page, context }) => {
        if (role !== 'anon') await loginBrowser(context, role);
        await page.goto(p);
        await settle(page);
        const { sw, cw, offenders } = await page.evaluate(() => {
          const cw = document.documentElement.clientWidth;
          const offenders = Array.from(document.querySelectorAll('body *'))
            .filter((e) => e.getBoundingClientRect().right > cw + 1)
            .slice(0, 5)
            .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${(e.className?.toString?.() ?? '').split(' ').join('.')}`);
          return { sw: document.documentElement.scrollWidth, cw, offenders };
        });
        expect(sw, `scrollWidth ${sw} > clientWidth ${cw}; offenders: ${offenders.join(', ')}`).toBeLessThanOrEqual(cw + 1);
      });
    }
  }
});
