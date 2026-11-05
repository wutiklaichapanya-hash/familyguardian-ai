// Visual-review screenshots of the redesigned web app (synthetic demo data only).
// Usage (from apps/web): BASE=http://localhost:3300 node scripts/shots.mjs [outDir]
// Default outDir: ../../docs/design/redesign. Each screen is saved as <name>.png (first viewport,
// as a phone user sees it) and, for long screens, <name>_full.png (whole page).
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3300';
const OUT = process.argv[2] ?? new URL('../../../docs/design/redesign', import.meta.url).pathname;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
mkdirSync(OUT, { recursive: true });

const H = { 'x-fg-csrf': '1', 'content-type': 'application/json' };
const SMS =
  'ธนาคารแจ้ง: บัญชีของท่านจะถูกระงับภายใน 24 ชม. กรุณายืนยันตัวตนด่วนที่ hxxp://kbank-secure[.]xyz และแจ้งรหัส OTP ที่ได้รับ ห้ามบอกผู้อื่น';

const browser = await chromium.launch();
const mk = (opts = {}) =>
  browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'th-TH',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    ...opts,
  });
const login = async (ctx, email, password) => {
  const r = await ctx.request.post(`${BASE}/api/v1/auth/login`, { headers: H, data: { email, password } });
  if (!r.ok()) throw new Error(`login ${email} ${r.status()}`);
};
const hideDev = (pg) => pg.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
const want = (name) => !ONLY || ONLY.some((o) => name.startsWith(o));
const settle = async (pg) => {
  await pg.waitForLoadState('networkidle');
  await hideDev(pg);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(300);
};
async function shot(pg, name, { full = false, scrollTo } = {}) {
  if (scrollTo) await pg.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), scrollTo);
  else await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.waitForTimeout(150);
  await pg.screenshot({ path: `${OUT}/${name}.png` });
  if (full) {
    const tag = await pg.addStyleTag({ content: '.tabbar,.emergency-bar,.topbar{position:static!important}' });
    await pg.screenshot({ path: `${OUT}/${name}_full.png`, fullPage: true });
    await tag.evaluate((n) => n.remove());
  }
  console.log('saved', name);
}
async function visit(pg, path) {
  await pg.goto(`${BASE}${path}`);
  await settle(pg);
}

// Anonymous screens
const anon = await mk();
const ap = await anon.newPage();
if (want('welcome')) { await visit(ap, '/'); await shot(ap, 'welcome', { full: true }); }
if (want('login')) { await visit(ap, '/login'); await shot(ap, 'login', { full: true }); }

// Senior (Somsri)
const senior = await mk();
await login(senior, 'somsri@demo.fg', 'Demo-Senior-2026');
const p = await senior.newPage();
if (want('home')) { await visit(p, '/home'); await shot(p, 'home', { full: true }); }
if (want('checkin')) { await visit(p, '/checkin'); await shot(p, 'checkin', { full: true }); }
if (want('scam')) {
  await visit(p, '/scam-check');
  await shot(p, 'scam_form');
  await p.fill('#scam-text', SMS);
  await p.click('button[type="submit"]');
  await p.waitForSelector('#result-h', { timeout: 15000 });
  await settle(p);
  await shot(p, 'scam_result', { full: true, scrollTo: 'main' });
}
if (want('pause')) {
  await visit(p, '/guardian-pause');
  await shot(p, 'pause_form', { full: true });
  await p.fill('#amount', '25000');
  for (const [k, v] of [['knowsRecipientPersonally', 'no'], ['pressuredToActNow', 'yes'], ['toldToKeepSecret', 'yes'], ['verifiedIndependently', 'no']]) {
    await p.check(`#${k}-${v}`);
  }
  await p.click('button[type="submit"]');
  await p.waitForSelector('#pause-result-h', { timeout: 15000 });
  await settle(p);
  await shot(p, 'pause_result', { full: true, scrollTo: 'main' });
}
if (want('help')) {
  await visit(p, '/help');
  await p.click('button.btn-primary.btn-block');
  await p.waitForSelector('#help-status-h', { timeout: 15000 });
  await settle(p);
  await shot(p, 'help_status', { full: true, scrollTo: '#help-status-h' });
}
if (want('emergency')) { await visit(p, '/emergency'); await shot(p, 'emergency', { full: true }); }
if (want('privacy')) { await visit(p, '/privacy'); await shot(p, 'privacy', { full: true }); }
if (want('notifications')) { await visit(p, '/notifications'); await shot(p, 'notifications'); }
if (want('contacts')) { await visit(p, '/contacts'); await shot(p, 'contacts'); }

// Family (Nok)
if (want('family')) {
  const nok = await mk();
  await login(nok, 'nok@demo.fg', 'Demo-Family-2026');
  const np = await nok.newPage();
  await visit(np, '/family');
  await shot(np, 'family', { full: true });
  await nok.close();
}

// Home at 320px and in dark mode
if (want('home_320')) {
  const narrow = await mk({ viewport: { width: 320, height: 640 } });
  await login(narrow, 'somsri@demo.fg', 'Demo-Senior-2026');
  const q = await narrow.newPage();
  await visit(q, '/home');
  const sw = await q.evaluate(() => document.documentElement.scrollWidth);
  console.log('320px scrollWidth', sw);
  await shot(q, 'home_320', { full: true });
  await narrow.close();
}
if (want('home_dark')) {
  const dark = await mk({ colorScheme: 'dark' });
  await login(dark, 'somsri@demo.fg', 'Demo-Senior-2026');
  const q = await dark.newPage();
  await visit(q, '/home');
  await shot(q, 'home_dark', { full: true });
  await dark.close();
}

await browser.close();
console.log('screenshots in', OUT);
