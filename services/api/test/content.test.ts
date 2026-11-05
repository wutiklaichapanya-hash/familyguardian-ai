// onlyMe / noteShared, per-recipient shares, grantee DTO minimisation, directory.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupEnv, json, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => { env = await setupEnv(); });
afterAll(async () => { await env.close(); });

describe('check-ins: onlyMe and noteShared', () => {
  it('onlyMe check-ins are never visible to anyone else; notes only when noteShared', async () => {
    const somsri = await env.as('somsri');
    const a = json(await somsri.post('/me/checkins', { mood: 'worried', note: 'private-note-A', onlyMe: true, noteShared: true }));
    expect(a.onlyMe).toBe(true);
    expect(a.noteShared).toBe(false); // onlyMe overrides noteShared
    const b = json(await somsri.post('/me/checkins', { mood: 'okay', note: 'hidden-note-B', noteShared: false }));
    const c = json(await somsri.post('/me/checkins', { mood: 'happy', note: 'shared-note-C', noteShared: true }));

    const own = json<any[]>(await somsri.get('/me/checkins'));
    expect(own.map((x) => x.id)).toEqual(expect.arrayContaining([a.id, b.id, c.id]));
    expect(own.find((x) => x.id === a.id).note).toBe('private-note-A');

    const nokRes = await (await env.as('nok')).get(`/seniors/${env.ids.somsri}/checkins`);
    const seen = json<any[]>(nokRes);
    expect(seen.find((x) => x.id === a.id)).toBeUndefined();
    expect(nokRes.body).not.toContain('private-note-A');
    expect(nokRes.body).not.toContain('hidden-note-B');
    const sb = seen.find((x) => x.id === b.id)!;
    expect(sb).not.toHaveProperty('note');
    expect(sb).not.toHaveProperty('noteShared');
    expect(sb).not.toHaveProperty('onlyMe');
    expect(seen.find((x) => x.id === c.id).note).toBe('shared-note-C');
    // seeded onlyMe row is excluded too
    expect(nokRes.body).not.toContain('บันทึกส่วนตัว');

    // the dashboard never surfaces the onlyMe row either
    const dash = json(await (await env.as('nok')).get('/dashboard'));
    expect(dash.seniors[0].latestCheckin.mood).toBe('happy');
  });

  it('days is capped at 90', async () => {
    expect((await (await env.as('somsri')).get('/me/checkins?days=91')).statusCode).toBe(400);
    expect((await (await env.as('nok')).get(`/seniors/${env.ids.somsri}/checkins?days=90`)).statusCode).toBe(200);
  });
});

describe('ScamShield + Guardian Pause sharing', () => {
  it('raw scam text is returned only to the senior; grantee view has no submittedText/sharedWith', async () => {
    await env.reseed();
    const own = json<any[]>(await (await env.as('somsri')).get('/me/scam-checks'));
    expect(own[0].submittedText).toContain('[SYNTHETIC]');
    expect(own[0].submittedText).not.toContain('http://'); // defanged
    expect(own[0].sharedWith).toEqual([env.ids.nok]);
    const r = await (await env.as('nok')).get(`/seniors/${env.ids.somsri}/scam-checks`);
    const shared = json<any[]>(r);
    expect(shared).toHaveLength(1);
    expect(shared[0]).not.toHaveProperty('submittedText');
    expect(shared[0]).not.toHaveProperty('sharedWith');
    expect(r.body).not.toContain('http://bit.ly');
  });

  it('share recipients must be confirmed members with the matching grant and not caregivers (generic 400)', async () => {
    const somsri = await env.as('somsri');
    const sc = json(await somsri.post('/me/scam-checks', { text: '[SYNTHETIC] โอนเงินด่วน แจ้ง OTP' }));
    for (const who of [env.ids.anan, env.ids.pim, env.ids.admin, '00000000-0000-4000-8000-000000000000']) {
      const r = await somsri.post(`/me/scam-checks/${sc.id}/share`, { shareWithUserIds: [who] });
      expect(r.statusCode).toBe(400);
      expect(json(r).error.code).toBe('SHARE_NOT_ALLOWED');
    }
    const ok = await somsri.post(`/me/scam-checks/${sc.id}/share`, { shareWithUserIds: [env.ids.nok] });
    expect(ok.statusCode).toBe(200);
    expect(json(ok).sharedWith).toEqual([env.ids.nok]);
    // someone else's item → 404
    expect((await somsri.post('/me/scam-checks/00000000-0000-4000-8000-000000000000/share', { shareWithUserIds: [env.ids.nok] })).statusCode).toBe(404);
  });

  it('shares are per recipient: an item shared with Nok is not visible to Anan even after Anan gets the grant', async () => {
    const somsri = await env.as('somsri');
    await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'scam_checks', password: 'Demo-Senior-2026' });
    const anan = json<any[]>(await (await env.as('anan')).get(`/seniors/${env.ids.somsri}/scam-checks`));
    expect(anan).toEqual([]);
  });

  it('Guardian Pause: grantee sees amount bucket only, never the amount, answers or note', async () => {
    const somsri = await env.as('somsri');
    const p = json(await somsri.post('/me/guardian-pause', {
      amountThb: 45_000, recipientNote: 'secret-note', answers: { knowsRecipientPersonally: false, pressuredToActNow: true, toldToKeepSecret: true, verifiedIndependently: false },
    }));
    expect(p.level).toBe('stop_and_verify');
    expect(p.simulationOnly).toBe(true);
    expect((await somsri.post(`/me/guardian-pause/${p.id}/share`, { shareWithUserIds: [env.ids.pim] })).statusCode).toBe(400);
    const shared = await somsri.post(`/me/guardian-pause/${p.id}/share`, { shareWithUserIds: [env.ids.nok] });
    expect(json(shared).sharedWith).toEqual([env.ids.nok]);
    const r = await (await env.as('nok')).get(`/seniors/${env.ids.somsri}/guardian-pause`);
    const items = json<any[]>(r);
    expect(items[0].amountBucket).toBe('10k_50k');
    expect(items[0]).not.toHaveProperty('amountThb');
    expect(items[0]).not.toHaveProperty('answers');
    expect(r.body).not.toContain('secret-note');
    const dash = json(await (await env.as('nok')).get('/dashboard'));
    expect(dash.seniors[0].status).toBe('verify_possible_scam');
  });
});

describe('directory', () => {
  it('has 1669, 191, 1441, 1300 — all needs_human_verification, no source, no bank numbers', async () => {
    const d = json<any[]>(await (await env.as('somsri')).get('/directory?country=TH'));
    expect(d.map((x) => x.phone)).toEqual(['1669', '191', '1441', '1300']);
    for (const e of d) { expect(e.verification).toBe('needs_human_verification'); expect(e.sourceUrl).toBeNull(); expect(e.kind).not.toBe('bank_fraud'); }
    const pub = await env.anon().get('/directory');
    expect(pub.statusCode).toBe(200); // public: logged-out emergency page
    expect(json<any[]>(pub)).toHaveLength(4);
  });

  it('call log records "call started from app", never connected', async () => {
    const somsri = await env.as('somsri');
    const d = json<any[]>(await somsri.get('/directory'));
    const r = json(await somsri.post('/me/call-logs', { directoryEntryId: d[2].id }));
    expect(r.kind).toBe('call_started_from_app');
    expect(r.label.toLowerCase()).not.toContain('connected');
  });
});
