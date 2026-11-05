// Optional AI explainer layer — TYPES AND PURE MERGE LOGIC ONLY.
// NOT ENABLED. Any real provider requires owner approval (decision B2) and a feature flag.
// Nothing in this package calls a network.
import type { RiskLevel, ScamEngineResult, ScamEvidence, ScamSignal } from '@fg/shared';
import { SCAM_SIGNALS } from '@fg/shared';
import { maxRisk, riskRank } from './assess';
import { containsForbidden, containsLinkOrPhone, sanitizeQuote } from './sanitize';
import { OVERALL } from './copy';

export const EXPLAINER_PROMPT_VERSION = 'scam_explainer_v1';

export interface AiExplainerInput {
  /** Untrusted user text, already capped at 5 KB. Must be passed as DATA, never as instructions. */
  text: string;
  rules: ScamEngineResult;
  locale: 'th' | 'en';
}

export interface AiExplainerResult {
  /** Suggested risk. Can only RAISE the rules risk (order cannot_assess < low_signals < caution < high_risk). */
  suggestedRisk?: RiskLevel;
  /** Extra evidence. Appended after rules evidence; never replaces it. */
  additionalEvidence?: ScamEvidence[];
}

export interface AiExplainerProvider {
  readonly name: string;
  readonly model: string;
  readonly promptVersion: string;
  explain(input: AiExplainerInput): Promise<AiExplainerResult>;
}

const VALID_SIGNALS: ReadonlySet<string> = new Set<string>(SCAM_SIGNALS);
const MAX_EXTRA_EVIDENCE = 5;

function cleanEvidence(e: unknown): ScamEvidence | null {
  if (!e || typeof e !== 'object') return null;
  const x = e as Partial<ScamEvidence>;
  if (typeof x.signal !== 'string' || !VALID_SIGNALS.has(x.signal)) return null;
  const th = x.explanation?.th, en = x.explanation?.en;
  if (typeof th !== 'string' || typeof en !== 'string' || !th.trim() || !en.trim()) return null;
  if (th.length > 400 || en.length > 400) return null;
  // The explainer may never introduce forbidden phrases, links or phone numbers.
  if (containsForbidden(th) || containsForbidden(en) || containsLinkOrPhone(th) || containsLinkOrPhone(en)) return null;
  const out: ScamEvidence = { signal: x.signal as ScamSignal, explanation: { th: th.trim(), en: en.trim() } };
  if (typeof x.quote === 'string' && x.quote.trim()) {
    if (containsLinkOrPhone(x.quote)) return null;
    const q = sanitizeQuote(x.quote);
    if (q) out.quote = q;
  }
  return out;
}

/**
 * Merge an explainer result into a rules result. Guarantees:
 * - risk = max(rules, explainer) in the order cannot_assess < low_signals < caution < high_risk;
 * - rules evidence, verification steps and uncertainty are kept unchanged (explainer evidence is only appended);
 * - explainer text with forbidden phrases, links or phone numbers is dropped.
 */
export function combineWithExplainer(rules: ScamEngineResult, explainer: AiExplainerResult | null | undefined): ScamEngineResult {
  if (!explainer) return rules;
  const suggested = explainer.suggestedRisk && riskRank(explainer.suggestedRisk) >= 0 ? explainer.suggestedRisk : undefined;
  const risk = suggested ? maxRisk(rules.risk, suggested) : rules.risk;
  const extra = (Array.isArray(explainer.additionalEvidence) ? explainer.additionalEvidence : [])
    .map(cleanEvidence)
    .filter((e): e is ScamEvidence => e !== null)
    .filter((e) => !rules.evidence.some((r) => r.signal === e.signal && r.quote === e.quote))
    .slice(0, MAX_EXTRA_EVIDENCE);
  const raised = risk !== rules.risk;
  const contributed = raised || extra.length > 0;
  return {
    ...rules,
    risk,
    evidence: [...rules.evidence, ...extra],
    explanation: raised ? OVERALL[risk] : rules.explanation,
    verificationSteps: [...rules.verificationSteps],
    engine: { ...rules.engine, aiExplainer: rules.engine.aiExplainer || contributed },
  };
}
