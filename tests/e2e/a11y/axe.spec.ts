// UX spec §2 / QA §9: axe-core on every main screen, per role. Expect 0 serious/critical violations.
// Writes a machine-readable summary to tests/e2e/test-results/axe-summary.json for QA_REPORT.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { SCREENS, loginBrowser, settle, type Who } from '../helpers';

const SUMMARY = path.join(__dirname, '..', 'test-results', 'axe-summary.json');
type Row = { role: string; path: string; id: string; impact: string; help: string; nodes: number; sample: string };
const rows: Row[] = [];

test.afterAll(() => {
  fs.mkdirSync(path.dirname(SUMMARY), { recursive: true });
  let prev: Row[] = [];
  try { prev = JSON.parse(fs.readFileSync(SUMMARY, 'utf8')); } catch { /* first write */ }
  const merged = [...prev.filter((p) => !rows.some((r) => r.role === p.role && r.path === p.path)), ...rows];
  fs.writeFileSync(SUMMARY, JSON.stringify(merged, null, 2));
});

for (const role of Object.keys(SCREENS) as (Who | 'anon')[]) {
  for (const p of SCREENS[role]) {
    test(`axe: ${role} ${p} has 0 serious/critical violations`, async ({ page, context }) => {
      if (role !== 'anon') await loginBrowser(context, role);
      await page.goto(p);
      await settle(page);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      for (const v of res.violations) {
        rows.push({ role, path: p, id: v.id, impact: v.impact ?? 'unknown', help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') ?? '' });
      }
      if (res.violations.length === 0) rows.push({ role, path: p, id: '-', impact: 'none', help: '', nodes: 0, sample: '' });
      const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} nodes, e.g. ${v.nodes[0]?.target?.join(' ')})`)).toEqual([]);
    });
  }
}
