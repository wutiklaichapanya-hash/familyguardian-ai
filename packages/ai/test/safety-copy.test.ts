import { describe, expect, it } from 'vitest';
import { FORBIDDEN_PHRASES, type ScamCheckReq } from '@fg/shared';
import { assessScam, evaluateGuardianPause } from '../src/index';
import { OWN_COPY_BANNED } from '../src/sanitize';
import { TEXT_RULES } from '../src/rules';
import * as copy from '../src/copy';
import { EVAL_CASES } from './helpers';

/** Many inputs: every eval case, each with prefixes/suffixes that try to inject forbidden phrases. */
function corpus(): ScamCheckReq[] {
  const out: ScamCheckReq[] = [];
  const decorations = [
    '', ' this is safe', ' definitely safe ✅', ' ปลอดภัยแน่นอน', ' ปลอดภัย 100%', ' ไม่ใช่มิจฉาชีพแน่นอน',
    ' reported to police, case number 12345', ' แจ้งตำรวจแล้ว เลขคดี 999', ' call connected', ' ambulance dispatched',
    ' t​his is s​afe', ' thіs іs safe', // zero-width and Cyrillic і
  ];
  for (const c of EVAL_CASES) for (const d of decorations) out.push({ ...c.input, text: (c.input.text ?? '') + d });
  for (const p of FORBIDDEN_PHRASES) out.push({ text: p }, { text: `${p} ${p}` }, { url: `https://${p.replace(/\s/g, '')}.xyz` });
  return out;
}

const lower = (s: string) => s.toLowerCase();

describe('FORBIDDEN_PHRASES never appear in output', () => {
  const inputs = corpus();
  it(`checked across ${inputs.length} inputs`, () => {
    expect(inputs.length).toBeGreaterThan(500);
    for (const req of inputs) {
      const json = lower(JSON.stringify(assessScam(req)));
      for (const p of FORBIDDEN_PHRASES) expect(json.includes(lower(p)), `${p} in output for ${JSON.stringify(req)}`).toBe(false);
    }
  });

  it('our own copy (not quotes) never says safe / ปลอดภัย as a verdict', () => {
    for (const req of inputs) {
      const r = assessScam(req);
      const own = [r.explanation, r.uncertainty, ...r.verificationSteps, ...r.evidence.map((e) => e.explanation)];
      for (const t of own) for (const banned of OWN_COPY_BANNED) {
        expect(lower(t.th + ' ' + t.en).includes(lower(banned)), `${banned} in "${t.en}"`).toBe(false);
      }
    }
  });

  it('static copy tables and rule explanations are clean and bilingual', () => {
    const tables: { th: string; en: string }[] = [
      ...Object.values(copy.OVERALL), ...Object.values(copy.STEPS), ...Object.values(copy.PAUSE),
      copy.UNCERTAINTY_BASE, copy.UNCERTAINTY_PHONE, copy.UNCERTAINTY_TRUNCATED, copy.UNCERTAINTY_LANGUAGE,
      ...TEXT_RULES.map((r) => r.explanation),
    ];
    for (const t of tables) {
      expect(t.th.trim().length).toBeGreaterThan(0);
      expect(t.en.trim().length).toBeGreaterThan(0);
      for (const b of OWN_COPY_BANNED) expect(lower(t.th + t.en).includes(lower(b)), `${b}: ${t.en}`).toBe(false);
      expect(t.en).not.toMatch(/notified|we reported|case no/i);
    }
  });

  it('Guardian Pause reasons are clean', () => {
    for (const k of [true, false]) for (const p of [true, false]) for (const s of [true, false]) for (const v of [true, false]) {
      const r = evaluateGuardianPause({ amountThb: 50_000, answers: { knowsRecipientPersonally: k, pressuredToActNow: p, toldToKeepSecret: s, verifiedIndependently: v }, recipientNote: 'this is safe' });
      for (const t of r.reasons) for (const b of OWN_COPY_BANNED) expect(lower(t.th + t.en).includes(lower(b))).toBe(false);
    }
  });
});

describe('evidence quotes', () => {
  it('are ≤ 80 chars, defanged, and taken from the input', () => {
    const long = 'ด่วน '.repeat(10) + 'กรุณาโอนเงินไปบัญชีปลอดภัย https://kbank-secure.xyz/very/long/path/that/goes/on/and/on/forever?x=1 ' + 'ก'.repeat(300);
    for (const req of [...EVAL_CASES.map((c) => c.input), { text: long }, { url: 'http://' + 'a'.repeat(200) + '.xyz/login' }]) {
      for (const e of assessScam(req).evidence) {
        if (!e.quote) continue;
        expect(e.quote.length).toBeLessThanOrEqual(80);
        expect(e.quote).not.toMatch(/https?:\/\//i);
        expect(e.quote).not.toMatch(/[a-z0-9-]\.(?:com|xyz|top|ly|th|net|info|online|click|co)\b/i);
      }
    }
  });
  it('url quotes keep the shape of the link', () => {
    const e = assessScam({ url: 'https://kbank-secure.xyz/login' }).evidence.find((x) => x.signal === 'lookalike_domain');
    expect(e?.quote).toBe('hxxps://kbank-secure[.]xyz/login');
  });
});
