// Computes each agent's "% complete" = share of its expected deliverables that exist on disk.
// It measures file presence, not quality or test results. Test results come from agent_state.json
// (filled in by the lead agent from each agent's final report).
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const skip = new Set(['node_modules', '.next', '.git', 'dist', 'coverage']);
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { if (skip.has(n)) continue; const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else if (s.size > 0) files.push(relative(ROOT, p)); } })(ROOT);
const has = (re, min = 1) => files.filter((f) => re.test(f)).length >= min;
const page = (r) => new RegExp(`^apps/web/app/(.*/)?${r}/page\\.tsx$`);
const AGENTS = [
  { id: 'backend', agent: 'Backend & Database', area: 'services/api', items: [
    ['server', /^services\/api\/src\/server\.ts$/], ['schema', /^services\/api\/src\/db\/schema\.ts$/],
    ['migrations', /^services\/api\/(src\/db\/migrate\.ts|drizzle\/.*\.sql|src\/db\/migrations\/.*\.sql)$/],
    ['seed', /^services\/api\/src\/db\/seed\.ts$/], ['policy engine', /^services\/api\/src\/policy\.ts$/],
    ['notification worker', /^services\/api\/src\/.*notif.*\.ts$/i], ['route modules (5+)', /^services\/api\/src\/routes\/.*\.ts$/, 5],
    ['tests (4+ files)', /^services\/api\/test\/.*\.test\.ts$/, 4], ['README', /^services\/api\/README\.md$/] ] },
  { id: 'ai', agent: 'AI & Fraud Intelligence', area: 'packages/ai', items: [
    ['public API', /^packages\/ai\/src\/index\.ts$/], ['scam rules', /^packages\/ai\/src\/.*(scam|rule).*\.ts$/i],
    ['guardian pause', /^packages\/ai\/src\/.*(pause|guardian).*\.ts$/i], ['eval cases', /^packages\/ai\/evals\/scam_cases\.json$/],
    ['eval runner', /^packages\/ai\/evals\/run-eval\.ts$/], ['eval report', /^packages\/ai\/evals\/EVAL_REPORT\.md$/],
    ['explainer prompt', /^packages\/ai\/prompts\/scam_explainer_v1\.md$/], ['tests (2+)', /^packages\/ai\/test\/.*\.test\.ts$/, 2],
    ['README', /^packages\/ai\/README\.md$/] ] },
  { id: 'web', agent: 'Frontend + UX', area: 'apps/web', items: [
    ['proxy config', /^apps\/web\/next\.config\.(ts|mjs|js)$/], ['layout', /^apps\/web\/app\/layout\.tsx$/], ['API client', /^apps\/web\/lib\/api\.ts$/],
    ['Thai strings', /^apps\/web\/lib\/i18n\/th\.ts$/], ['English strings', /^apps\/web\/lib\/i18n\/en\.ts$/], ['PWA manifest', /^apps\/web\/app\/manifest\.ts$/],
    ...['login', 'home', 'checkin', 'contacts', 'scam-check', 'guardian-pause', 'help', 'emergency', 'privacy', 'invite/accept', 'family', 'alerts/\\[id\\]', 'notifications', 'admin', 'billing']
      .map((r) => [`screen /${r.replace(/\\/g, '')}`, page(r)]),
    ['copy safety test', /^apps\/web\/test\/copy\.test\.ts$/], ['README', /^apps\/web\/README\.md$/], ['screen inventory', /^docs\/product\/SCREEN_INVENTORY\.md$/] ] },
  { id: 'payments', agent: 'Payments (engineering)', area: 'packages/payments', items: [
    ['public API', /^packages\/payments\/src\/index\.ts$/], ['plans & entitlements', /^packages\/payments\/src\/.*(plan|entitle).*\.ts$/i],
    ['sandbox provider', /^packages\/payments\/src\/.*sandbox.*\.ts$/i], ['adapter stubs (6)', /^packages\/payments\/src\/.*(promptpay|card|truemoney|shopeepay|apple|google).*\.ts$/i, 6],
    ['tests', /^packages\/payments\/test\/.*\.test\.ts$/], ['README', /^packages\/payments\/README\.md$/] ] },
  { id: 'security', agent: 'Independent Security', area: 'docs/safety', items: [
    ['design review', /^docs\/safety\/SECURITY_REVIEW_01_design\.md$/] ] },
  { id: 'research', agent: 'Product & Research', area: 'docs/research', items: [
    ['PRD', /^docs\/product\/PRD\.md$/], ...['01_persona', '02_customer_journey', '03_hmw', '04_heart_head', '05_product_levels', '06_pilot_plan', '07_ethical_ai', '08_healthcare_safety']
      .map((n) => [n.replace(/^\d+_/, '').replace(/_/g, ' '), new RegExp(`^docs/research/${n}.*\\.md$`)]) ] },
  { id: 'business', agent: 'Business & ENT501', area: 'docs/business', items: [
    ...['01_stp', '02_business_model', '03_revenue', '04_unit_economics', '05_competitor', '06_social'].map((n) => [n.replace(/^\d+_/, '').replace(/_/g, ' '), new RegExp(`^docs/business/${n}.*\\.md$`)]),
    ['ENT501 outline', /^docs\/presentation\/ENT501.*\.md$/] ] },
  { id: 'qa', agent: 'Independent QA (E2E)', area: 'tests/e2e', items: [
    ['playwright config', /^tests\/e2e\/playwright\.config\.ts$/], ['API contract specs (2+)', /^tests\/e2e\/api\/.*\.spec\.ts$/, 2],
    ['UI journey specs (4+)', /^tests\/e2e\/ui\/.*\.spec\.ts$/, 4], ['QA report', /^docs\/qa\/QA_REPORT_01\.md$/] ] },
  { id: 'devops', agent: 'DevOps & Release', area: 'infrastructure', items: [
    ['API Dockerfile', /^infrastructure\/Dockerfile\.api$/], ['web Dockerfile', /^infrastructure\/Dockerfile\.web$/], ['CI workflow', /^\.github\/workflows\/ci\.yml$/],
    ['secret-scan config', /^\.gitleaks\.toml$/], ['known limitations', /^docs\/KNOWN_LIMITATIONS\.md$/], ['release readiness', /^docs\/architecture\/RELEASE_READINESS\.md$/],
    ['local runbook', /^docs\/architecture\/RUNBOOK_LOCAL\.md$/] ] },
  { id: 'directory', agent: 'Help-directory research', area: 'docs/research', items: [
    ['verification evidence', /^docs\/research\/help_directory_verification\.md$/] ] },
  { id: 'codex-ux', agent: 'Codex (OpenAI) UX design review', area: 'docs/design', items: [
    ['design proposal', /^docs\/design\/CODEX_UX_DESIGN_01\.md$/] ] },
  { id: 'web-p0', agent: 'Frontend pass 2 (Codex P0 fixes, worktree)', area: 'apps/web', items: [['merged to main', /^docs\/decisions\/merged_web_p0\.flag$/]] },
  { id: 'api-v03', agent: 'Backend pass 2 (contract v0.3, worktree)', area: 'services/api', items: [['merged to main', /^docs\/decisions\/merged_api_v03\.flag$/]] },
  { id: 'codex-mock', agent: 'Codex (OpenAI) UI mockups', area: 'docs/design/mockups', items: [
    ['home mockup', /^docs\/design\/mockups\/mock_home\.png$/], ['scam mockup', /^docs\/design\/mockups\/mock_scam_result\.png$/], ['family mockup', /^docs\/design\/mockups\/mock_family\.png$/]] },
  { id: 'redesign', agent: 'Visual redesign (worktree)', area: 'apps/web', items: [['merged to main', /^docs\/decisions\/merged_redesign\.flag$/]] },
];
const statePath = join(ROOT, 'docs/decisions/agent_state.json');
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
const at = new Date().toISOString();
const rows = AGENTS.map((a) => {
  const done = a.items.filter(([, re, min]) => has(re, min));
  const missing = a.items.filter((i) => !done.includes(i)).map(([l]) => l);
  const s = state[a.id] ?? {};
  return { id: a.id, agent: a.agent, area: a.area, done: done.length, total: a.items.length,
    pct: Math.round((100 * done.length) / a.items.length), status: s.status ?? 'running',
    tests: s.tests ?? 'not reported yet', missing: missing.join(', ') || '—', measured_at: at };
});
const out = process.argv[2] ?? join(ROOT, 'docs/decisions/agent_status.json');
writeFileSync(out, JSON.stringify(rows, null, 2));
for (const r of rows) console.log(`${String(r.pct).padStart(3)}%  ${r.done}/${r.total}  ${r.status.padEnd(9)} ${r.agent}`);
