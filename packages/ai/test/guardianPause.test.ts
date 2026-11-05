import { describe, expect, it } from 'vitest';
import type { GuardianPauseAnswers } from '@fg/shared';
import { evaluateGuardianPause } from '../src/index';

const base: GuardianPauseAnswers = { knowsRecipientPersonally: true, pressuredToActNow: false, toldToKeepSecret: false, verifiedIndependently: true };
const run = (a: Partial<GuardianPauseAnswers>, amountThb = 1_000, recipientNote?: string) =>
  evaluateGuardianPause({ amountThb, answers: { ...base, ...a }, recipientNote });

describe('Guardian Pause', () => {
  it('directive example: THB 80,000 to an unknown, unverified recipient → stop_and_verify', () => {
    const r = run({ knowsRecipientPersonally: false, verifiedIndependently: false }, 80_000);
    expect(r.level).toBe('stop_and_verify');
    expect(r.reasons.some((x) => x.en.includes('large amount'))).toBe(true);
    expect(r.reasons.some((x) => x.en.includes('do not know the person'))).toBe(true);
  });
  it('known + verified + no pressure + no secret → proceed_with_care with a reason', () => {
    const r = run({});
    expect(r.level).toBe('proceed_with_care');
    expect(r.reasons.length).toBeGreaterThan(0);
  });
  it('secret alone → stop', () => expect(run({ toldToKeepSecret: true }).level).toBe('stop_and_verify'));
  it('pressure alone → stop', () => expect(run({ pressuredToActNow: true }).level).toBe('stop_and_verify'));
  it('unknown but verified → proceed_with_care (one risk answer)', () => expect(run({ knowsRecipientPersonally: false }).level).toBe('proceed_with_care'));
  it('known but unverified → proceed_with_care (one risk answer)', () => expect(run({ verifiedIndependently: false }).level).toBe('proceed_with_care'));
  it('large amount alone does not trigger stop, but adds a reason', () => {
    const r = run({}, 500_000);
    expect(r.level).toBe('proceed_with_care');
    expect(r.reasons.some((x) => x.en.includes('large amount'))).toBe(true);
  });
  it('amount below 10,000 adds no large-amount reason', () => {
    expect(run({}, 9_999).reasons.some((x) => x.en.includes('large amount'))).toBe(false);
    expect(run({}, 10_000).reasons.some((x) => x.en.includes('large amount'))).toBe(true);
  });
  it('exhaustive: stop iff (!knows && !verified) || secret || pressured || 2+ risk answers', () => {
    for (const k of [true, false]) for (const p of [true, false]) for (const s of [true, false]) for (const v of [true, false]) {
      const riskCount = [!k, p, s, !v].filter(Boolean).length;
      const expected = (!k && !v) || s || p || riskCount >= 2 ? 'stop_and_verify' : 'proceed_with_care';
      const r = evaluateGuardianPause({ amountThb: 100, answers: { knowsRecipientPersonally: k, pressuredToActNow: p, toldToKeepSecret: s, verifiedIndependently: v } });
      expect(r.level).toBe(expected);
      for (const x of r.reasons) { expect(x.th.length).toBeGreaterThan(0); expect(x.en.length).toBeGreaterThan(0); }
    }
  });
  it('a scam-like recipient note can only make it stricter', () => {
    expect(run({}, 2_000, 'เจ้าหน้าที่ตำรวจให้โอนเข้าบัญชีปลอดภัย').level).toBe('stop_and_verify');
    expect(run({}, 2_000, 'ค่าเทอมหลาน').level).toBe('proceed_with_care');
  });
  it('invalid amount gets a calm reason, does not throw', () => {
    expect(run({}, Number.NaN).reasons.some((x) => x.en.includes('amount is unclear'))).toBe(true);
  });
});
