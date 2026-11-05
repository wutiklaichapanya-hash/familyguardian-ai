import { describe, expect, it } from 'vitest';
import type { CheckinDTO } from '@fg/shared';
import { defang } from '../lib/defang';
import { translate } from '../lib/i18n/format';
import { buildTrend } from '../lib/trend';

describe('translate', () => {
  it('applies the polite particle in Thai and drops it in English', () => {
    expect(translate('th', 'checkin.saved', {}, 'ka')).toBe('บันทึกแล้วค่ะ');
    expect(translate('th', 'checkin.saved', {}, 'krap')).toBe('บันทึกแล้วครับ');
    expect(translate('en', 'checkin.saved', {}, 'krap')).toBe('Saved');
  });
  it('interpolates variables', () => {
    expect(translate('en', 'state.sent', { name: 'Nok' })).toBe('Alert sent to Nok');
  });
});

describe('buildTrend', () => {
  const today = new Date(2026, 10, 5, 15, 0, 0);
  const c = (d: Date, mood: CheckinDTO['mood']): CheckinDTO => ({ id: d.toISOString(), mood, noteShared: false, onlyMe: false, createdAt: d.toISOString() });

  it('returns 14 days with explicit gaps (null), oldest first', () => {
    const t = buildTrend([c(new Date(2026, 10, 5, 9), 'happy'), c(new Date(2026, 10, 3, 9), 'tired')], 14, today);
    expect(t).toHaveLength(14);
    expect(t[13]).toMatchObject({ date: '2026-11-05', mood: 'happy' });
    expect(t[12]).toMatchObject({ date: '2026-11-04', mood: null });
    expect(t[11]).toMatchObject({ date: '2026-11-03', mood: 'tired' });
    expect(t.filter((d) => d.mood === null)).toHaveLength(12);
  });
  it('keeps the latest entry of a day', () => {
    const t = buildTrend([c(new Date(2026, 10, 5, 8), 'worried'), c(new Date(2026, 10, 5, 12), 'okay')], 14, today);
    expect(t[13]?.mood).toBe('okay');
  });
});

describe('defang', () => {
  it('neutralises links and domains, and is idempotent', () => {
    const out = defang('กดเลย https://bank-th.example.com/login หรือ www.example.co');
    expect(out).toBe('กดเลย hxxps://bank-th[.]example[.]com/login หรือ www[.]example[.]co');
    expect(defang(out)).toBe(out);
  });
  it('leaves decimals and phone numbers as plain text', () => {
    expect(defang('โอน 1.5 ล้าน โทร 081-000-0001')).toBe('โอน 1.5 ล้าน โทร 081-000-0001');
  });
  it('defangs email addresses', () => {
    expect(defang('a@b.com')).toBe('a[@]b[.]com');
  });
});
