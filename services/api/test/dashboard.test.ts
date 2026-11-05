// Dashboard status is per viewer, from visible categories only; missing data is never negative.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { consentGrants, wellbeingCheckins } from '../src/db/schema';
import { setupEnv, json, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => { await env.reseed(); });
afterAll(async () => { await env.close(); });

const card = async (key: 'nok' | 'anan' | 'pim') => json(await (await env.as(key)).get('/dashboard')).seniors[0];

describe('dashboard', () => {
  it('seeded demo: Nok verify_possible_scam, Pim no_action_needed, Anan not_shared', async () => {
    const nok = await card('nok');
    expect(nok.status).toBe('verify_possible_scam');
    expect(nok.visibleCategories.sort()).toEqual(['checkins', 'contacts', 'help_requests', 'scam_checks', 'transfer_pauses']);
    expect(nok.sharedScamChecks).toHaveLength(1);
    const pim = await card('pim');
    expect(pim.status).toBe('no_action_needed');
    expect(pim).not.toHaveProperty('latestCheckin');
    expect(pim).not.toHaveProperty('sharedScamChecks');
    const anan = await card('anan');
    expect(anan.status).toBe('not_shared');
    expect(anan.visibleCategories).toEqual([]);
    expect(anan.lastUpdatedAt).toBeNull();
    expect(anan).not.toHaveProperty('latestCheckin');
  });

  it('missing data → latestCheckin null and no_action_needed (never negative)', async () => {
    await env.db.delete(wellbeingCheckins).where(eq(wellbeingCheckins.seniorId, env.ids.somsri));
    const somsri = await env.as('somsri');
    await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'checkins', password: 'Demo-Senior-2026' });
    const anan = await card('anan');
    expect(anan.latestCheckin).toBeNull();
    expect(anan.status).toBe('no_action_needed');
    expect(anan.lastUpdatedAt).toBeNull();
  });

  it('check_in_recommended ONLY when the latest shared mood is lonely or worried', async () => {
    const somsri = await env.as('somsri');
    await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'checkins', password: 'Demo-Senior-2026' });
    for (const mood of ['tired', 'prefer_not_to_answer', 'okay']) {
      await somsri.post('/me/checkins', { mood });
      expect((await card('anan')).status).toBe('no_action_needed');
    }
    await somsri.post('/me/checkins', { mood: 'lonely' });
    expect((await card('anan')).status).toBe('check_in_recommended');
    await somsri.post('/me/checkins', { mood: 'happy' });
    await somsri.post('/me/checkins', { mood: 'worried', onlyMe: true }); // private → ignored
    const c = await card('anan');
    expect(c.status).toBe('no_action_needed');
    expect(c.latestCheckin.mood).toBe('happy');
  });

  it('assistance_requested only for viewers holding help_requests, until acknowledged', async () => {
    const alert = json(await (await env.as('somsri')).post('/me/help-requests', {}));
    await env.queue.drain('notify-deliver');
    expect((await card('pim')).status).toBe('assistance_requested');
    expect((await card('nok')).status).toBe('assistance_requested');
    expect((await card('anan')).status).toBe('not_shared');
    expect((await card('pim')).pendingAlerts[0].deliveries).toHaveLength(1);
    await (await env.as('nok')).post(`/alerts/${alert.id}/ack`);
    expect((await card('pim')).status).toBe('no_action_needed');
  });

  it('a viewer with only checkins never gets verify_possible_scam; lastUpdatedAt only from visible items', async () => {
    await env.db.delete(wellbeingCheckins).where(eq(wellbeingCheckins.seniorId, env.ids.somsri));
    const somsri = await env.as('somsri');
    await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'checkins', password: 'Demo-Senior-2026' });
    await somsri.post('/me/checkins', { mood: 'okay', onlyMe: true });
    await somsri.post('/me/scam-checks', { text: '[SYNTHETIC] ด่วน แจ้ง OTP โอนเงิน' });
    const anan = await card('anan');
    expect(anan.status).toBe('no_action_needed');
    expect(anan.lastUpdatedAt).toBeNull(); // onlyMe + unshared activity is not revealed
  });

  it('expired grant drops the category from the card', async () => {
    await env.db.update(consentGrants).set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(consentGrants.granteeUserId, env.ids.nok), eq(consentGrants.category, 'scam_checks')));
    const nok = await card('nok');
    expect(nok.visibleCategories).not.toContain('scam_checks');
    expect(nok).not.toHaveProperty('sharedScamChecks');
    expect(nok.status).toBe('no_action_needed');
  });
});
