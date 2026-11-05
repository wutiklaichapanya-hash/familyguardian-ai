// ScamShield deterministic rules engine. Pure: no network, no clock, no randomness.
import type { RiskLevel, ScamCheckReq, ScamEngineResult, ScamEvidence, ScamSignal } from '@fg/shared';
import { OVERALL, STEPS, UNCERTAINTY_BASE, UNCERTAINTY_LANGUAGE, UNCERTAINTY_PHONE, UNCERTAINTY_TRUNCATED, UNCERTAINTY_UNPARSEABLE_URL } from './copy';
import { capBytes, normalizeText, sliceAround, type NormalizedText } from './normalize';
import { analyzePhone, findIntlNumbersInText } from './phone';
import { NEGATION_EN, NEGATION_TH, SECRECY_IN_WINDOW, TEXT_RULES, type Bi, type TextRule, type Weight } from './rules';
import { sanitizeQuote } from './sanitize';
import { analyzeUrl, extractUrls } from './url';

export const ENGINE_VERSION: string = 'rules-1.0.0';

/** Risk order used everywhere (and by combineWithExplainer): cannot_assess < low_signals < caution < high_risk. */
export const RISK_ORDER: readonly RiskLevel[] = ['cannot_assess', 'low_signals', 'caution', 'high_risk'];
export const riskRank = (r: RiskLevel): number => RISK_ORDER.indexOf(r);
export const maxRisk = (a: RiskLevel, b: RiskLevel): RiskLevel => (riskRank(a) >= riskRank(b) ? a : b);

/** Internal finding before it becomes contract evidence. */
export interface Finding {
  id: string;
  signal: ScamSignal;
  weight: Weight;
  action: boolean;
  contextOnly: boolean;
  quote?: string;
  explanation: Bi;
}

/** Signals that create pressure or false trust. Combined with a strong action they mean high risk. */
const PRESSURE: ReadonlySet<ScamSignal> = new Set(['urgency', 'impersonation', 'threat_or_fear', 'secrecy', 'suspicious_link', 'lookalike_domain', 'link_shortener']);

const LURE: ReadonlySet<ScamSignal> = new Set(['prize_or_lottery', 'investment_promise', 'romance', 'advance_fee']);
const STRONG_LINK_IDS: ReadonlySet<string> = new Set(['url_ip_host', 'url_at_sign', 'url_brand_lookalike', 'url_punycode']);

const NEG_WINDOW = 15;

function matchRule(rule: TextRule, n: NormalizedText): Finding | null {
  const tries: [RegExp[] | undefined, string, number[], RegExp][] = [
    [rule.th, n.compact, n.compactMap, NEGATION_TH],
    [rule.en, n.spaced, n.spacedMap, NEGATION_EN],
  ];
  for (const [patterns, hay, map, neg] of tries) {
    if (!patterns) continue;
    for (const re of patterns) {
      // Scan successive matches so one negated mention ("never share your OTP") does not hide a real request later.
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      for (const m of hay.matchAll(g)) {
        const start = m.index ?? 0;
        if (m[0].length === 0) continue;
        if (rule.negatable) {
          const win = hay.slice(Math.max(0, start - NEG_WINDOW * (hay === n.spaced ? 2 : 1)), start);
          if (neg.test(win) && !SECRECY_IN_WINDOW.test(win)) continue;
        }
        const end = start + m[0].length - 1;
        const os = map[start] ?? 0;
        const oe = (map[Math.min(end, map.length - 1)] ?? os) + 1;
        return {
          id: rule.id, signal: rule.signal, weight: rule.weight, action: !!rule.action, contextOnly: !!rule.contextOnly,
          quote: sliceAround(n.original, os, oe), explanation: rule.explanation,
        };
      }
    }
  }
  return null;
}

export interface Scored {
  risk: RiskLevel;
  findings: Finding[];
  points: number;
  notes: { truncated: boolean; noLanguage: boolean; badUrl: boolean; phoneGiven: boolean; hasUrl: boolean };
}

/** Core scoring, exposed for tests and evals. */
export function scoreScam(req: ScamCheckReq): Scored {
  const rawText = typeof req.text === 'string' ? req.text : '';
  const { text, truncated } = capBytes(rawText);
  const urlInput = typeof req.url === 'string' ? capBytes(req.url, 2048).text.trim() : '';
  const phoneInput = typeof req.phone === 'string' ? capBytes(req.phone, 64).text.trim() : '';

  const all: Finding[] = [];
  const n = normalizeText(text);

  // 1) text rules
  for (const rule of TEXT_RULES) {
    const f = matchRule(rule, n);
    if (f) all.push(f);
  }

  // 2) URLs: the explicit url field plus links found in the text (lexical only)
  const urls = new Set<string>();
  if (urlInput) urls.add(urlInput);
  for (const u of extractUrls(text)) urls.add(u.raw);
  let badUrl = false;
  let anyParsedUrl = false;
  for (const u of urls) {
    const a = analyzeUrl(u);
    if (!a.parsed) { if (u === urlInput) badUrl = true; continue; }
    anyParsedUrl = true;
    for (const f of a.findings) all.push({ id: f.id, signal: f.signal, weight: f.weight, action: !!f.action, contextOnly: false, quote: f.quote, explanation: f.explanation });
  }

  // 3) phone (low weight, always uncertain)
  let phoneParsed = false;
  if (phoneInput) {
    const p = analyzePhone(phoneInput);
    phoneParsed = p.parsed;
    for (const f of p.findings) all.push({ id: f.id, signal: 'unknown_number_pattern', weight: 1, action: false, contextOnly: false, quote: f.quote, explanation: f.explanation });
  }
  for (const m of findIntlNumbersInText(text).slice(0, 1)) {
    const p = analyzePhone(m.raw);
    for (const f of p.findings) all.push({ id: 'text_' + f.id, signal: 'unknown_number_pattern', weight: 1, action: false, contextOnly: false, quote: f.quote, explanation: f.explanation });
  }

  // De-duplicate by family id; drop context-only families unless something else fired.
  const byId = new Map<string, Finding>();
  for (const f of all) if (!byId.has(f.id)) byId.set(f.id, f);
  let findings = [...byId.values()];
  const hasNonContext = findings.some((f) => !f.contextOnly);
  if (!hasNonContext) findings = [];
  // If a specific impersonation family fired, the generic organisation mention adds nothing.
  if (findings.some((f) => f.signal === 'impersonation' && !f.contextOnly)) findings = findings.filter((f) => !f.contextOnly);

  // Score: max weight per signal, summed.
  const perSignal = new Map<ScamSignal, number>();
  for (const f of findings) perSignal.set(f.signal, Math.max(perSignal.get(f.signal) ?? 0, f.weight));
  const points = [...perSignal.values()].reduce((a, b) => a + b, 0);
  const strongSignals = [...perSignal.values()].filter((w) => w >= 2).length;
  const strongAction = findings.some((f) => f.action && f.weight === 3);
  const pressure = findings.some((f) => PRESSURE.has(f.signal) && f.id !== 'url_no_https');
  const strongActionCount = new Set(findings.filter((f) => f.action && f.weight === 3).map((f) => f.signal)).size;

  // A lure (prize, loan fee, investment, romance) plus a money request is the core advance-fee story.
  const lure = findings.some((f) => LURE.has(f.signal));
  const moneyAsk = (perSignal.get('payment_request') ?? 0) >= 2;
  // A disguised link (IP host, '@', look-alike, punycode) next to a claimed brand/agency is classic phishing.
  const disguisedLink = findings.some((f) => STRONG_LINK_IDS.has(f.id));
  const claimsBrand = perSignal.has('impersonation');

  const hasLetters = /[a-z฀-๿]/.test(n.compact);
  const meaningfulText = hasLetters && n.compact.length >= 6;
  const noLanguage = n.compact.length > 0 && !hasLetters;

  let risk: RiskLevel;
  if (findings.length === 0 && !meaningfulText && !anyParsedUrl && !phoneParsed) {
    risk = 'cannot_assess';
  } else if ((strongAction && pressure) || strongActionCount >= 2 || strongSignals >= 3 || points >= 7 || ((perSignal.get('lookalike_domain') ?? 0) >= 3 && points >= 5) || (lure && moneyAsk) || (disguisedLink && claimsBrand)) {
    risk = 'high_risk';
  } else if (points >= 2) {
    risk = 'caution';
  } else {
    risk = 'low_signals';
  }

  // Strongest first, then by signal order for determinism.
  findings.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  return { risk, findings, points, notes: { truncated, noLanguage, badUrl, phoneGiven: !!phoneInput, hasUrl: urls.size > 0 } };
}

function buildSteps(s: Scored): Bi[] {
  if (s.risk === 'cannot_assess') return [STEPS.pasteMore, STEPS.askFamily, STEPS.aoc1441, STEPS.neverShareOtp];
  const sig = new Set(s.findings.map((f) => f.signal));
  const ids = new Set(s.findings.map((f) => f.id));
  const steps: Bi[] = [];
  if (ids.has('impersonation_family_new_number')) steps.push(STEPS.oldNumber);
  steps.push(STEPS.officialNumber);
  if (s.notes.phoneGiven || sig.has('secrecy')) steps.push(STEPS.hangUp);
  steps.push(STEPS.askFamily);
  if (sig.has('payment_request') || sig.has('advance_fee') || sig.has('investment_promise') || sig.has('romance') || sig.has('prize_or_lottery')) steps.push(STEPS.noMoney);
  steps.push(STEPS.neverShareOtp);
  if (s.notes.hasUrl || sig.has('suspicious_link')) steps.push(STEPS.noLinks);
  steps.push(STEPS.noAppsFromLinks);
  steps.push(STEPS.aoc1441);
  return steps;
}

function joinBi(parts: Bi[]): Bi {
  return { th: parts.map((p) => p.th).join(' '), en: parts.map((p) => p.en).join(' ') };
}

export function assessScam(req: ScamCheckReq): ScamEngineResult {
  const s = scoreScam(req ?? {});
  // One evidence item per signal (strongest first); a manipulation attempt is always shown on its own.
  const seen = new Set<string>();
  const shown = s.findings.filter((f) => {
    const key = f.id === 'manipulation_attempt' ? f.id : f.signal;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const evidence: ScamEvidence[] = shown.map((f) => {
    const q = f.quote ? sanitizeQuote(f.quote) : '';
    return q ? { signal: f.signal, quote: q, explanation: f.explanation } : { signal: f.signal, explanation: f.explanation };
  });
  const unc: Bi[] = [UNCERTAINTY_BASE];
  if (s.notes.phoneGiven) unc.push(UNCERTAINTY_PHONE);
  if (s.notes.truncated) unc.push(UNCERTAINTY_TRUNCATED);
  if (s.notes.noLanguage) unc.push(UNCERTAINTY_LANGUAGE);
  if (s.notes.badUrl) unc.push(UNCERTAINTY_UNPARSEABLE_URL);
  return {
    risk: s.risk,
    evidence,
    explanation: OVERALL[s.risk],
    uncertainty: joinBi(unc),
    verificationSteps: buildSteps(s),
    engine: { name: 'rules', version: ENGINE_VERSION, aiExplainer: false },
  };
}
