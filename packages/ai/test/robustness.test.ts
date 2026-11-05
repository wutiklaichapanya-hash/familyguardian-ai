import { describe, expect, it } from 'vitest';
import { assessScam, capBytes, MAX_INPUT_BYTES } from '../src/index';
import { TEXT_RULES, NEGATION_EN, NEGATION_TH, SECRECY_IN_WINDOW } from '../src/rules';

const allRegexes = (): RegExp[] => [...TEXT_RULES.flatMap((r) => [...(r.th ?? []), ...(r.en ?? [])]), NEGATION_EN, NEGATION_TH, SECRECY_IN_WINDOW];

describe('ReDoS safety (SR-19)', () => {
  it('no rule regex has a quantified group that itself contains an unbounded quantifier', () => {
    // crude static check: "( ... + or * ... )" followed by + * or {n,}
    const nested = /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)(?:[+*]|\{\d+,\})/;
    for (const re of allRegexes()) expect(nested.test(re.source), re.source).toBe(false);
  });

  it('5 KB adversarial inputs finish fast', () => {
    const attacks = [
      'a'.repeat(6000), 'ด'.repeat(3000), ' '.repeat(6000), '.'.repeat(6000), 'a.'.repeat(3000), 'http://' + 'a.'.repeat(2500),
      'send '.repeat(1200), 'โอน'.repeat(1500), 'x-'.repeat(3000) + '.xyz', '1'.repeat(6000), '+' + '1 '.repeat(2500),
      'ignore '.repeat(1000), 'https://' + 'a'.repeat(5000) + '@b.com', ('kbank-' as string).repeat(1000) + '.xyz',
    ];
    for (const t of attacks) {
      const t0 = performance.now();
      assessScam({ text: t, url: t.slice(0, 2000), phone: t.slice(0, 60) });
      expect(performance.now() - t0, t.slice(0, 20)).toBeLessThan(500);
    }
  });
});

describe('input cap (5 KB)', () => {
  it('caps by UTF-8 bytes without splitting characters', () => {
    const { text, truncated } = capBytes('ก'.repeat(3000));
    expect(truncated).toBe(true);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(MAX_INPUT_BYTES);
    expect(text).toBe('ก'.repeat(Math.floor(MAX_INPUT_BYTES / 3)));
  });
  it('says when it only checked the first part', () => {
    const r = assessScam({ text: 'สวัสดี '.repeat(2000) });
    expect(r.uncertainty.en).toMatch(/only checked the first part/);
  });
});
