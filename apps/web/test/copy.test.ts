import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DASHBOARD_LABELS, FORBIDDEN_PHRASES, MOOD_LABELS, NO_DATA_LABEL, RISK_LABELS } from '@fg/shared';
import { en } from '../lib/i18n/en';
import { th } from '../lib/i18n/th';

const ROOT = join(__dirname, '..');

/** Same normalisation the security review asks for (SR-20): NFC, strip zero-width, collapse spaces, lowercase. */
function norm(s: string): string {
  return s.normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').toLowerCase();
}

/** Web-local additions: healthcare-safety review HS-09 "block outright", plus UX rules (no "safe" verdict, no "connected"). */
const WEB_EXTRA_FORBIDDEN = [
  'mood score', 'คะแนนอารมณ์', 'mental health score', 'ตรวจพบ', 'อาการ', 'symptom', 'abnormal', 'ผิดปกติ',
  'at risk of', 'เสี่ยงต่อภาวะ', 'ภาวะ', 'anxiety disorder', 'โรค', 'treatment', 'การรักษา',
  'monitoring your health', 'ติดตามสุขภาพ', 'we noticed you seem', 'คุณดูเหมือน',
  'ปลอดภัย', 'call completed', 'connected', 'feelsense',
  // SR-20 proposals
  'ไม่มีอันตราย', 'เชื่อถือได้', 'ของจริง', 'ไม่ใช่มิจฉาชีพ', 'โอนได้เลย', 'กำลังไปช่วย', 'หน่วยงานได้รับแจ้งแล้ว',
  'legitimate', 'genuine', 'safe to', 'verified sender', 'help is on the way', 'police notified',
];
const ALL_FORBIDDEN = [...FORBIDDEN_PHRASES, ...WEB_EXTRA_FORBIDDEN].map(norm);

function hits(text: string): string[] {
  const n = norm(text);
  const out = ALL_FORBIDDEN.filter((p) => n.includes(p));
  // Word-boundary check for the English verdict "safe".
  if (/\bsafe\b/.test(n)) out.push('safe');
  return out;
}

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

describe('i18n catalogues', () => {
  it('th and en have exactly the same keys', () => {
    const thKeys = Object.keys(th).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys.filter((k) => !thKeys.includes(k))).toEqual([]);
    expect(thKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it('no string is empty and placeholders match between languages', () => {
    for (const k of Object.keys(th) as (keyof typeof th)[]) {
      expect(th[k].trim(), `th ${k}`).not.toBe('');
      expect(en[k].trim(), `en ${k}`).not.toBe('');
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v) => v !== 'p').sort();
      expect(vars(en[k]), `placeholders ${k}`).toEqual(vars(th[k]));
    }
  });

  it.each([
    ['th', th],
    ['en', en],
  ] as const)('%s strings contain no forbidden phrase', (_l, cat) => {
    const bad = Object.entries(cat).flatMap(([k, v]) => hits(v).map((h) => `${k}: "${h}"`));
    expect(bad).toEqual([]);
  });

  it('shared labels used by the UI contain no forbidden phrase', () => {
    const labels = [DASHBOARD_LABELS, MOOD_LABELS, RISK_LABELS].flatMap((o) => Object.values(o)).concat([NO_DATA_LABEL]);
    const bad = labels.flatMap((l) => [...hits(l.th), ...hits(l.en)]);
    expect(bad).toEqual([]);
  });
});

describe('source files', () => {
  it('app/, components/ and lib/ contain no forbidden phrase', () => {
    const files = ['app', 'components', 'lib'].flatMap((d) => walk(join(ROOT, d), ['.ts', '.tsx', '.css']));
    expect(files.length).toBeGreaterThan(10);
    const bad: string[] = [];
    for (const f of files) {
      // The CSS env() name `safe-area-inset-*` is a platform token, not a verdict; strip only that.
      const text = readFileSync(f, 'utf8').replace(/\bsafe-area-inset-(?:top|right|bottom|left)\b/g, '');
      for (const h of hits(text)) bad.push(`${relative(ROOT, f)}: "${h}"`);
    }
    expect(bad).toEqual([]);
  });

  it('never uses dangerouslySetInnerHTML', () => {
    const files = ['app', 'components'].flatMap((d) => walk(join(ROOT, d), ['.tsx']));
    const bad = files.filter((f) => readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'));
    expect(bad).toEqual([]);
  });
});
