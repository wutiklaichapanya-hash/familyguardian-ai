// Shared helpers for the QA suite. Everything here follows the CONTRACT v0.2 (packages/shared/src/api.ts).
import { expect, request as pwRequest, type APIRequestContext, type APIResponse, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AlertDTO, CheckinDTO, DashboardDTO, GrantDTO, MeRes, MemberDTO, ScamAssessmentDTO, GuardianPauseDTO, ShareCategory,
} from '../../packages/shared/src/api';

export const BASE = 'http://localhost:3100';
export const API = '/api/v1';
export const CSRF = { 'x-fg-csrf': '1' } as const;

export type Who = 'somsri' | 'nok' | 'anan' | 'pim' | 'admin';
export const USERS: Record<Who, { email: string; password: string; name: RegExp }> = {
  somsri: { email: 'somsri@demo.fg', password: 'Demo-Senior-2026', name: /สมศรี|Somsri/ },
  nok: { email: 'nok@demo.fg', password: 'Demo-Family-2026', name: /นก|Nok/ },
  anan: { email: 'anan@demo.fg', password: 'Demo-Family-2026', name: /อนันต์|Anan/ },
  pim: { email: 'pim@demo.fg', password: 'Demo-Care-2026', name: /พิม|Pim/ },
  admin: { email: 'admin@demo.fg', password: 'Demo-Admin-2026', name: /Admin/ },
};
export const ROLES_ALL: Who[] = ['somsri', 'nok', 'anan', 'pim', 'admin'];

// ---------- session cache ----------
// The API limits logins to 5 / minute per IP+email (a real control we must not trip in normal runs), so the suite
// signs each role in once and re-uses the session cookie (persisted to .auth/ so it survives worker restarts).
// A cached session is validated with GET /auth/me before use and refreshed if the server rotated or dropped it.
const AUTH_DIR = path.join(__dirname, '.auth');
const memState = new Map<Who, StorageState>();
type StorageState = Awaited<ReturnType<APIRequestContext['storageState']>>;

function readState(who: Who): StorageState | undefined {
  if (memState.has(who)) return memState.get(who);
  try { const s = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, `${who}.json`), 'utf8')); memState.set(who, s); return s; } catch { return undefined; }
}
function writeState(who: Who, s: StorageState) {
  memState.set(who, s);
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(path.join(AUTH_DIR, `${who}.json`), JSON.stringify(s));
}

async function freshLogin(who: Who): Promise<StorageState> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctx = await pwRequest.newContext({ baseURL: BASE });
    const res = await ctx.post(`${API}/auth/login`, { headers: CSRF, data: { email: USERS[who].email, password: USERS[who].password } });
    if (res.status() === 200) { const s = await ctx.storageState(); await ctx.dispose(); writeState(who, s); return s; }
    const body = await safeText(res);
    await ctx.dispose();
    if (res.status() !== 429) throw new Error(`login as ${who} failed: ${res.status()} ${body}`);
    await new Promise((r) => setTimeout(r, 61_000)); // wait out the 1-minute login window
  }
  throw new Error(`login as ${who}: still rate limited after retries`);
}

/** Storage state holding a valid session for `who`. */
export async function sessionState(who: Who): Promise<StorageState> {
  const cached = readState(who);
  if (cached) {
    const ctx = await pwRequest.newContext({ baseURL: BASE, storageState: cached });
    const ok = (await ctx.get(`${API}/auth/me`)).status() === 200;
    await ctx.dispose();
    if (ok) return cached;
  }
  return freshLogin(who);
}

/** An API context signed in as `who` (re-uses the cached session; cookie jar is per context). */
export async function apiAs(who: Who): Promise<APIRequestContext> {
  const state = await sessionState(who);
  const ctx = await pwRequest.newContext({ baseURL: BASE, storageState: state, extraHTTPHeaders: { accept: 'application/json' } });
  // keep the cache current if the server rotates the cookie (e.g. after step-up)
  const origDispose = ctx.dispose.bind(ctx);
  ctx.dispose = async (...args: Parameters<APIRequestContext['dispose']>) => {
    try { const s = await ctx.storageState(); if (s.cookies.length) writeState(who, s); } catch { /* already closed */ }
    return origDispose(...args);
  };
  return ctx;
}

export async function anonApi(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { accept: 'application/json' } });
}

export async function safeText(res: APIResponse): Promise<string> {
  try { return (await res.text()).slice(0, 500); } catch { return '<no body>'; }
}

export async function json<T>(res: APIResponse, expected = 200): Promise<T> {
  const text = await res.text();
  expect(res.status(), `${res.url()} expected ${expected}, body: ${text.slice(0, 500)}`).toBe(expected);
  return JSON.parse(text) as T;
}

export async function ok<T>(res: APIResponse): Promise<T> {
  const text = await res.text();
  expect([200, 201], `${res.url()} expected 2xx, got ${res.status()}: ${text.slice(0, 500)}`).toContain(res.status());
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function me(ctx: APIRequestContext): Promise<MeRes> {
  return ok<MeRes>(await ctx.get(`${API}/auth/me`));
}

export interface Ids { somsri: string; nok: string; anan: string; pim: string; admin: string }

/** Resolve every demo user id (senior's /me/members gives member ids; /auth/me gives own id). */
export async function resolveIds(somsri: APIRequestContext): Promise<Ids> {
  const s = await me(somsri);
  const members = await ok<MemberDTO[]>(await somsri.get(`${API}/me/members`));
  const find = (re: RegExp) => {
    const m = members.find((x) => re.test(x.name));
    if (!m) throw new Error(`member ${re} not found in /me/members: ${JSON.stringify(members.map((x) => x.name))}`);
    return m.userId;
  };
  const adminCtx = await apiAs('admin');
  const a = await me(adminCtx);
  await adminCtx.dispose();
  return { somsri: s.user.id, nok: find(/นก|Nok/), anan: find(/อนันต์|Anan/), pim: find(/พิม|Pim/), admin: a.user.id };
}

export async function activeGrants(somsri: APIRequestContext): Promise<GrantDTO[]> {
  const grants = await ok<GrantDTO[]>(await somsri.get(`${API}/me/grants`));
  const now = Date.now();
  return grants.filter((g) => !g.revokedAt && new Date(g.expiresAt).getTime() > now);
}

export async function ensureGrant(somsri: APIRequestContext, granteeUserId: string, category: ShareCategory): Promise<GrantDTO> {
  const existing = (await activeGrants(somsri)).find((g) => g.granteeUserId === granteeUserId && g.category === category);
  if (existing) return existing;
  const res = await somsri.post(`${API}/me/grants`, { headers: CSRF, data: { granteeUserId, category, password: USERS.somsri.password } });
  return ok<GrantDTO>(res);
}

export async function revokeGrant(somsri: APIRequestContext, granteeUserId: string, category: ShareCategory): Promise<void> {
  const g = (await activeGrants(somsri)).filter((x) => x.granteeUserId === granteeUserId && x.category === category);
  for (const grant of g) {
    const res = await somsri.delete(`${API}/me/grants/${grant.id}`, { headers: CSRF });
    expect([200, 204], `revoke ${category}: ${await safeText(res)}`).toContain(res.status());
  }
}

export const SEEDED_GRANTS: Record<'nok' | 'pim', ShareCategory[]> = {
  nok: ['checkins', 'help_requests', 'scam_checks', 'transfer_pauses', 'contacts'],
  pim: ['help_requests', 'care_tasks'],
};

/** Put Nok's and Pim's grants back to the seeded state (best effort; used in afterAll). */
export async function restoreSeedGrants(somsri: APIRequestContext, ids: Ids) {
  for (const c of SEEDED_GRANTS.nok) await ensureGrant(somsri, ids.nok, c);
  for (const c of SEEDED_GRANTS.pim) await ensureGrant(somsri, ids.pim, c);
}

export async function createCheckin(somsri: APIRequestContext, data: Record<string, unknown>): Promise<CheckinDTO> {
  return ok<CheckinDTO>(await somsri.post(`${API}/me/checkins`, { headers: CSRF, data }));
}

export async function createScamCheck(somsri: APIRequestContext, text = FAKE_BANK_SMS): Promise<ScamAssessmentDTO> {
  return ok<ScamAssessmentDTO>(await somsri.post(`${API}/me/scam-checks`, { headers: CSRF, data: { text, locale: 'th' } }));
}

export async function createPause(somsri: APIRequestContext, amountThb = 80000): Promise<GuardianPauseDTO> {
  return ok<GuardianPauseDTO>(await somsri.post(`${API}/me/guardian-pause`, {
    headers: CSRF,
    data: { amountThb, answers: { knowsRecipientPersonally: false, pressuredToActNow: true, toldToKeepSecret: true, verifiedIndependently: false } },
  }));
}

export async function dashboardCard(ctx: APIRequestContext, seniorId: string) {
  const d = await ok<DashboardDTO>(await ctx.get(`${API}/dashboard`));
  return d.seniors.find((s) => s.seniorId === seniorId);
}

export async function helpRequest(somsri: APIRequestContext, message = 'QA ทดสอบ ขอความช่วยเหลือ'): Promise<AlertDTO> {
  return ok<AlertDTO>(await somsri.post(`${API}/me/help-requests`, { headers: CSRF, data: { message } }));
}

export const RANDOM_UUID = '3f2b8c1e-9a4d-4e6b-8f1a-2c3d4e5f6a7b';

/** Synthetic Thai fake-bank SMS (impersonation + urgency + credential/OTP request + lookalike link). */
export const FAKE_BANK_SMS =
  'ธนาคารกสิกรไทย: บัญชีของท่านถูกระงับชั่วคราว กรุณายืนยันตัวตนภายใน 24 ชั่วโมง มิฉะนั้นบัญชีจะถูกปิดถาวร ' +
  'คลิก https://kbank-verify-th.com/login แล้วกรอกรหัส OTP ที่ได้รับทาง SMS ห้ามบอกรหัสนี้กับผู้อื่น';

// ---------- browser helpers ----------

/** Sign a browser context in with the cached session cookie for `who`. */
export async function loginBrowser(context: BrowserContext, who: Who) {
  const state = await sessionState(who);
  await context.addCookies(state.cookies);
}

/** Sign in through the real login form (used where the journey itself starts at login). */
export async function loginViaForm(page: Page, who: Who) {
  await page.goto('/login');
  await page.getByLabel(/^(อีเมล|Email)$/).fill(USERS[who].email);
  await page.getByLabel(/^(รหัสผ่าน|Password)$/).fill(USERS[who].password);
  await page.getByRole('button', { name: /^(เข้าสู่ระบบ|Sign in)$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
}

/** Visible text of the main document (innerText = what a person sees). */
export async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body?.innerText ?? '');
}

/** Wait until the client app has rendered something other than a loading placeholder. */
export async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForFunction(() => !/กำลังโหลด|Loading…/.test(document.body?.innerText ?? ''), undefined, { timeout: 15_000 }).catch(() => undefined);
}

/** Main screens per role (paths from the web agent's screen inventory / UX spec §4). */
export const SCREENS: Record<Who | 'anon', string[]> = {
  anon: ['/', '/login', '/emergency'],
  somsri: ['/home', '/checkin', '/contacts', '/scam-check', '/guardian-pause', '/help', '/emergency', '/privacy', '/notifications'],
  nok: ['/family', '/notifications', '/invite/accept', '/emergency'],
  anan: ['/family', '/notifications', '/emergency'],
  pim: ['/family', '/notifications', '/emergency'],
  admin: ['/admin', '/emergency'],
};
