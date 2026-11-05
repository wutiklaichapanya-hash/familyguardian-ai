// Run: npx tsx packages/ai/evals/run-eval.ts   (add --write to refresh the numbers block in EVAL_REPORT.md)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RiskLevel, ScamCheckReq } from '@fg/shared';
import { assessScam, ENGINE_VERSION, RISK_ORDER, riskRank } from '../src/index';

interface EvalCase {
  id: string; label: 'scam' | 'benign' | 'edge'; category: string; lang: string | null;
  input: ScamCheckReq; expectedMinRisk: RiskLevel; expectedMaxRisk?: RiskLevel;
}

const here = dirname(fileURLToPath(import.meta.url));
const { cases } = JSON.parse(readFileSync(join(here, 'scam_cases.json'), 'utf8')) as { cases: EvalCase[] };

const rows = cases.map((c) => {
  const r = assessScam(c.input);
  const okMin = riskRank(r.risk) >= riskRank(c.expectedMinRisk);
  const okMax = c.expectedMaxRisk ? riskRank(r.risk) <= riskRank(c.expectedMaxRisk) : true;
  return { c, risk: r.risk, ok: okMin && okMax, signals: [...new Set(r.evidence.map((e) => e.signal))] };
});

const flagged = (r: RiskLevel) => r === 'caution' || r === 'high_risk';
const scam = rows.filter((r) => r.c.label === 'scam');
const benign = rows.filter((r) => r.c.label === 'benign');
const recall = scam.filter((r) => flagged(r.risk)).length;
const highRecall = scam.filter((r) => r.c.expectedMinRisk === 'high_risk');
const highHit = highRecall.filter((r) => r.risk === 'high_risk').length;
const fp = benign.filter((r) => r.risk === 'high_risk').length;
const benignCaution = benign.filter((r) => r.risk === 'caution').length;
const pass = rows.filter((r) => r.ok).length;
const pct = (a: number, b: number) => (b === 0 ? 'n/a' : `${((100 * a) / b).toFixed(1)}%`);

const labels = ['scam', 'benign', 'edge'] as const;
const table = [
  `| label \\ predicted | ${RISK_ORDER.join(' | ')} | total |`,
  `|---|${RISK_ORDER.map(() => '---').join('|')}|---|`,
  ...labels.map((l) => {
    const rs = rows.filter((r) => r.c.label === l);
    return `| ${l} | ${RISK_ORDER.map((k) => rs.filter((r) => r.risk === k).length).join(' | ')} | ${rs.length} |`;
  }),
].join('\n');

const failures = rows.filter((r) => !r.ok)
  .map((r) => `- ${r.c.id} (${r.c.label}/${r.c.category}): expected ${r.c.expectedMinRisk}${r.c.expectedMaxRisk ? '..' + r.c.expectedMaxRisk : '+'}, got **${r.risk}** [${r.signals.join(', ') || 'no signals'}]`);

const summary = [
  `Engine: rules ${ENGINE_VERSION} · cases: ${rows.length} (scam ${scam.length}, benign ${benign.length}, edge ${rows.length - scam.length - benign.length})`,
  `Recall on scam cases (risk ∈ {caution, high_risk}): ${recall}/${scam.length} = ${pct(recall, scam.length)}`,
  `High-risk recall (cases expected high_risk that got high_risk): ${highHit}/${highRecall.length} = ${pct(highHit, highRecall.length)}`,
  `False-positive rate on benign cases (risk = high_risk): ${fp}/${benign.length} = ${pct(fp, benign.length)}`,
  `Benign cases shown as caution (not counted as FP, but friction): ${benignCaution}/${benign.length} = ${pct(benignCaution, benign.length)}`,
  `Cases meeting their expected range: ${pass}/${rows.length} = ${pct(pass, rows.length)}`,
].join('\n');

const out = `${summary}\n\nConfusion table\n\n${table}\n\nCases outside expected range\n${failures.length ? failures.join('\n') : '- none'}\n`;
console.log(out);

if (process.argv.includes('--write')) {
  const reportPath = join(here, 'EVAL_REPORT.md');
  const report = readFileSync(reportPath, 'utf8');
  const block = `<!-- EVAL:START -->\n\`\`\`text\n${summary}\n\`\`\`\n\n${table}\n\n**Cases outside expected range**\n\n${failures.length ? failures.join('\n') : '- none'}\n<!-- EVAL:END -->`;
  writeFileSync(reportPath, report.replace(/<!-- EVAL:START -->[\s\S]*?<!-- EVAL:END -->/, block));
  console.log('EVAL_REPORT.md updated');
}
