import { describe, expect, it } from 'vitest';
import { RISK_LEVELS, type RiskLevel } from '@fg/shared';
import { assessScam, combineWithExplainer, RISK_ORDER, riskRank, type AiExplainerProvider } from '../src/index';

describe('risk order', () => {
  it('is cannot_assess < low_signals < caution < high_risk', () => {
    expect(RISK_ORDER).toEqual(['cannot_assess', 'low_signals', 'caution', 'high_risk']);
    expect([...RISK_ORDER].sort()).toEqual([...RISK_LEVELS].sort());
    expect(riskRank('cannot_assess')).toBeLessThan(riskRank('low_signals'));
    expect(riskRank('low_signals')).toBeLessThan(riskRank('caution'));
    expect(riskRank('caution')).toBeLessThan(riskRank('high_risk'));
  });
});

describe('combineWithExplainer', () => {
  const inputs = [{ text: '' }, { text: 'แม่ เย็นนี้กลับบ้านกี่โมง' }, { text: 'Final notice, pay now' }, { text: 'Urgent: send the OTP to me now' }];

  it('never lowers risk, for every rules level × every suggested level', () => {
    for (const req of inputs) {
      const rules = assessScam(req);
      for (const s of RISK_LEVELS as readonly RiskLevel[]) {
        const merged = combineWithExplainer(rules, { suggestedRisk: s });
        expect(riskRank(merged.risk)).toBe(Math.max(riskRank(rules.risk), riskRank(s)));
      }
    }
  });

  it('can raise risk and marks aiExplainer, with matching explanation', () => {
    const rules = assessScam({ text: 'แม่ เย็นนี้กลับบ้านกี่โมง' });
    const merged = combineWithExplainer(rules, { suggestedRisk: 'high_risk' });
    expect(merged.risk).toBe('high_risk');
    expect(merged.engine.aiExplainer).toBe(true);
    expect(merged.engine.name).toBe('rules');
    expect(merged.explanation.en).toMatch(/High risk/);
  });

  it('keeps all rules evidence and verification steps; only appends', () => {
    const rules = assessScam({ text: 'Urgent: send the OTP to me now' });
    const merged = combineWithExplainer(rules, {
      suggestedRisk: 'low_signals',
      additionalEvidence: [{ signal: 'secrecy', quote: 'between us', explanation: { th: 'มีการขอให้เก็บเป็นความลับ', en: 'It asks for secrecy.' } }],
    });
    expect(merged.risk).toBe(rules.risk);
    expect(merged.evidence.slice(0, rules.evidence.length)).toEqual(rules.evidence);
    expect(merged.evidence).toHaveLength(rules.evidence.length + 1);
    expect(merged.verificationSteps).toEqual(rules.verificationSteps);
    expect(merged.uncertainty).toEqual(rules.uncertainty);
  });

  it('drops explainer evidence with links, phone numbers, forbidden phrases or invalid signals', () => {
    const rules = assessScam({ text: 'Final notice, pay now' });
    const bad = [
      { signal: 'urgency', explanation: { th: 'โทร 02-000-0001', en: 'Call 02-000-0001 to check' } },
      { signal: 'urgency', explanation: { th: 'ไปที่เว็บ', en: 'Visit https://help.example.com' } },
      { signal: 'urgency', explanation: { th: 'ดูที่ help.example.com', en: 'see help-example.com' } },
      { signal: 'urgency', explanation: { th: 'โทร 1441', en: 'Call 1441 now' } },
      { signal: 'urgency', explanation: { th: 'ปลอดภัยแน่นอน', en: 'This is safe' } },
      { signal: 'urgency', quote: 'call +66 81 000 0001', explanation: { th: 'ก', en: 'a' } },
      { signal: 'not_a_signal', explanation: { th: 'ก', en: 'a' } },
      { signal: 'urgency', explanation: { th: '', en: '' } },
    ] as never[];
    const merged = combineWithExplainer(rules, { additionalEvidence: bad });
    expect(merged.evidence).toEqual(rules.evidence);
    expect(merged.engine.aiExplainer).toBe(false);
  });

  it('defangs and caps explainer quotes', () => {
    const rules = assessScam({ text: 'Final notice, pay now' });
    const merged = combineWithExplainer(rules, { additionalEvidence: [{ signal: 'urgency', quote: 'x'.repeat(200), explanation: { th: 'เร่ง', en: 'Rushed.' } }] });
    expect(merged.evidence.at(-1)?.quote?.length).toBeLessThanOrEqual(80);
  });

  it('null / garbage explainer result changes nothing', () => {
    const rules = assessScam({ text: 'Final notice, pay now' });
    expect(combineWithExplainer(rules, null)).toEqual(rules);
    expect(combineWithExplainer(rules, { suggestedRisk: 'safe' as never })).toEqual({ ...rules });
  });

  it('provider interface is type-only (a fake provider compiles, nothing is called)', () => {
    const fake: AiExplainerProvider = { name: 'fake', model: 'none', promptVersion: 'scam_explainer_v1', explain: async () => ({}) };
    expect(fake.name).toBe('fake');
  });
});
