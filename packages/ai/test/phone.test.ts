import { describe, expect, it } from 'vitest';
import { analyzePhone, assessScam } from '../src/index';

describe('phone hints (low weight, uncertain)', () => {
  it('international number is a weak signal only', () => {
    const r = assessScam({ phone: '+234 801 000 0001' });
    expect(r.evidence.map((e) => e.signal)).toContain('unknown_number_pattern');
    expect(r.risk).toBe('low_signals');
    expect(r.uncertainty.en).toMatch(/faked/);
  });
  it('normal Thai mobile has no finding', () => expect(analyzePhone('081-000-0001').findings).toHaveLength(0));
  it('+66 mobile is normal', () => expect(analyzePhone('+66 81 000 0001').findings).toHaveLength(0));
  it('+66 0… spoof-style hint', () => expect(analyzePhone('+66 081 000 0001').findings.map((f) => f.id)).toContain('phone_spoof_hint'));
  it('unusual length', () => expect(analyzePhone('08100').findings.map((f) => f.id)).toContain('phone_unusual_format'));
  it('hotline recognised, no finding', () => expect(analyzePhone('1441').isShortHotline).toBe(true));
  it('explanations never call the caller a criminal', () => {
    for (const p of ['+234 801 000 0001', '+66 081 000 0001', '08100']) {
      for (const f of analyzePhone(p).findings) {
        expect(f.explanation.en.toLowerCase()).not.toMatch(/criminal|is a scammer|definitely/);
        expect(f.explanation.th).not.toMatch(/เป็นมิจฉาชีพแน่นอน|อาชญากร/);
      }
    }
  });
});
