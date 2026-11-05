// LEXICAL URL analysis only. This module never fetches, resolves or opens anything.
import type { ScamSignal } from '@fg/shared';
import type { Bi, Weight } from './rules';

export interface UrlFinding {
  id: string;
  signal: ScamSignal;
  weight: Weight;
  action?: boolean;
  quote: string;
  explanation: Bi;
}

export interface UrlAnalysis {
  raw: string;
  parsed: boolean;
  host?: string;
  findings: UrlFinding[];
}

/** Brand tokens and the domains that really belong to them (registrable domains). */
const BRANDS: { tokens: string[]; name: Bi; official: string[] }[] = [
  { tokens: ['kbank', 'kasikorn', 'kasikornbank', 'kplus'], name: { th: 'ธนาคารกสิกรไทย', en: 'KBank' }, official: ['kasikornbank.com', 'kbank.co.th'] },
  { tokens: ['scb', 'scbeasy', 'siamcommercial'], name: { th: 'ธนาคารไทยพาณิชย์', en: 'SCB' }, official: ['scb.co.th', 'scbeasy.com'] },
  { tokens: ['krungthai', 'ktb', 'paotang', 'pao-tang'], name: { th: 'ธนาคารกรุงไทย', en: 'Krungthai' }, official: ['krungthai.com', 'ktb.co.th'] },
  { tokens: ['bangkokbank', 'bbl', 'bualuang'], name: { th: 'ธนาคารกรุงเทพ', en: 'Bangkok Bank' }, official: ['bangkokbank.com'] },
  { tokens: ['gsb', 'mymo'], name: { th: 'ธนาคารออมสิน', en: 'GSB' }, official: ['gsb.or.th'] },
  { tokens: ['krungsri', 'kma'], name: { th: 'ธนาคารกรุงศรี', en: 'Krungsri' }, official: ['krungsri.com'] },
  { tokens: ['ttb', 'ttbbank', 'tmb'], name: { th: 'ธนาคารทีทีบี', en: 'ttb' }, official: ['ttbbank.com'] },
  { tokens: ['baac'], name: { th: 'ธ.ก.ส.', en: 'BAAC' }, official: ['baac.or.th'] },
  { tokens: ['true', 'truemoney', 'truemove', 'trueid'], name: { th: 'ทรู', en: 'True' }, official: ['true.th', 'truecorp.co.th', 'truemoney.com', 'trueid.net', 'truemove-h.com'] },
  { tokens: ['ais', 'mypais', 'myais'], name: { th: 'เอไอเอส', en: 'AIS' }, official: ['ais.th', 'ais.co.th'] },
  { tokens: ['dtac'], name: { th: 'ดีแทค', en: 'dtac' }, official: ['dtac.co.th'] },
  { tokens: ['line', 'lineofficial'], name: { th: 'LINE', en: 'LINE' }, official: ['line.me', 'line.biz', 'linecorp.com', 'line-apps.com'] },
  { tokens: ['thaipost', 'thailandpost'], name: { th: 'ไปรษณีย์ไทย', en: 'Thailand Post' }, official: ['thailandpost.co.th', 'thailandpost.com'] },
  { tokens: ['kerry', 'kerryexpress'], name: { th: 'เคอรี่', en: 'Kerry Express' }, official: ['kerryexpress.com', 'th.kerryexpress.com'] },
  { tokens: ['flash', 'flashexpress'], name: { th: 'แฟลช เอ็กซ์เพรส', en: 'Flash Express' }, official: ['flashexpress.co.th', 'flashexpress.com'] },
  { tokens: ['pea'], name: { th: 'การไฟฟ้าส่วนภูมิภาค', en: 'PEA' }, official: ['pea.co.th'] },
  { tokens: ['mea'], name: { th: 'การไฟฟ้านครหลวง', en: 'MEA' }, official: ['mea.or.th'] },
  { tokens: ['revenue', 'rdgo', 'rd-go'], name: { th: 'กรมสรรพากร', en: 'Revenue Department' }, official: ['rd.go.th'] },
  { tokens: ['police', 'royalthaipolice'], name: { th: 'ตำรวจ', en: 'Police' }, official: ['police.go.th', 'royalthaipolice.go.th'] },
  { tokens: ['dsi'], name: { th: 'ดีเอสไอ', en: 'DSI' }, official: ['dsi.go.th'] },
  { tokens: ['shopee'], name: { th: 'ช้อปปี้', en: 'Shopee' }, official: ['shopee.co.th', 'shopee.com'] },
  { tokens: ['lazada'], name: { th: 'ลาซาด้า', en: 'Lazada' }, official: ['lazada.co.th', 'lazada.com'] },
];

const SHORTENERS = new Set([
  'bit.ly', 'bitly.com', 'tinyurl.com', 'cutt.ly', 's.id', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'v.gd', 'rb.gy',
  'shorturl.at', 'shorturl.asia', 'tiny.cc', 'rebrand.ly', 't.ly', 'buff.ly', 'qrco.de', 'shorte.st', 'adf.ly',
  'bl.ink', 'short.io', 'tny.im', 'lnk.to', 'urlz.fr', 'gg.gg', 'x.co', 'cli.re', 'link.in.th', 'u.to',
]);

const RISKY_TLDS = new Set([
  'xyz', 'top', 'click', 'icu', 'buzz', 'live', 'shop', 'online', 'site', 'cc', 'tk', 'ml', 'ga', 'cf', 'gq',
  'work', 'rest', 'vip', 'win', 'loan', 'cyou', 'cfd', 'sbs', 'monster', 'quest', 'bond', 'support', 'help',
  'fun', 'pw', 'cn', 'ru', 'su', 'zip', 'mov', 'today', 'link', 'info', 'biz', 'club', 'store', 'app',
]);

/** Second-level labels under which the registrable domain has three parts (kbank.co.th). */
const SECOND_LEVEL = new Set(['co', 'or', 'go', 'ac', 'in', 'mi', 'net', 'com', 'org', 'gov', 'edu']);

/** TLDs we accept when spotting a bare domain inside free text (avoids "v1.2" or "a.m."). */
const KNOWN_TLDS = new Set([...RISKY_TLDS, 'com', 'net', 'org', 'th', 'me', 'io', 'co', 'ly', 'id', 'gl', 'gd', 'gy', 'at', 'asia', 'to', 'de', 'uk', 'us', 'fr', 'jp', 'sg', 'my', 'hk', 'tw', 'kr', 'vn', 'la', 'kh', 'mm', 'ph', 'in', 'au', 'nz', 'ca', 'tv', 'ws', 'im', 'ai', 'gov', 'edu', 'page', 'dev', 'net']);

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Find URL-like tokens in free text. ReDoS-safe: we split on whitespace/Thai with a single
 * character class (linear), then validate each token with anchored, non-nested checks.
 */
export function extractUrls(text: string): { raw: string; index: number }[] {
  const out: { raw: string; index: number }[] = [];
  for (const m of text.matchAll(/[^\s\u0E00-\u0E7F]+/g)) {
    const idx = m.index ?? 0;
    let tok = m[0].replace(/^[(<\["'“‘]+/, '');
    const lead = m[0].length - tok.length;
    tok = tok.replace(/[),.;:!?'"\]>”’]+$/, '');
    if (tok.length < 4 || !tok.includes('.')) continue;
    const schemeMatch = /^(?:https?|hxxps?):\/\//i.exec(tok);
    const rest = schemeMatch ? tok.slice(schemeMatch[0].length) : tok;
    const authority = rest.split(/[/?#]/)[0] ?? '';
    const hostPort = authority.includes('@') ? authority.slice(authority.lastIndexOf('@') + 1) : authority;
    if (!schemeMatch && authority.includes('@') && !rest.slice(authority.length).length) continue; // email
    const host = (hostPort.split(':')[0] ?? '').toLowerCase();
    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
    if (isIp) {
      if (schemeMatch || rest.length > authority.length || hostPort.includes(':')) out.push({ raw: tok, index: idx + lead });
      continue;
    }
    const labels = host.split('.');
    if (labels.length < 2 || labels.some((l) => l.length === 0 || l.length > 63)) continue;
    // Allow non-ASCII labels (IDN homographs) when a scheme is present; the URL parser punycodes them.
    const asciiOk = labels.every((l) => HOST_LABEL.test(l) || /^xn--[a-z0-9-]{1,59}$/.test(l));
    if (!asciiOk && !schemeMatch) continue;
    const tld = labels[labels.length - 1] ?? '';
    if (!schemeMatch && !/^www\./i.test(tok) && !KNOWN_TLDS.has(tld) && !tld.startsWith('xn--')) continue;
    if (/^\d+$/.test(tld)) continue;
    out.push({ raw: tok, index: idx + lead });
  }
  return out;
}

export function registrableDomain(host: string): string {
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const sld = parts[parts.length - 2] ?? '';
  const tld = parts[parts.length - 1] ?? '';
  if (tld.length === 2 && SECOND_LEVEL.has(sld)) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

/** Undo common digit/letter swaps used in look-alike domains (k8ank, scb-0nline). */
function deLeet(s: string): string {
  return s.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/8/g, 'b').replace(/rn/g, 'm').replace(/vv/g, 'w');
}

function isOfficial(host: string, official: string[]): boolean {
  return official.some((d) => host === d || host.endsWith('.' + d));
}

function brandLookalike(host: string): { name: Bi } | null {
  const reg = registrableDomain(host);
  // Look only at the labels a person reads (drop the TLD and the generic second level).
  const labels = host.split('.');
  const meaningful = labels.slice(0, reg.split('.').length === 3 ? -2 : -1).join('.');
  const words = new Set([meaningful, deLeet(meaningful)].flatMap((m) => m.split(/[.\-_]/)).filter(Boolean));
  const joined = [meaningful.replace(/[.\-_]/g, ''), deLeet(meaningful).replace(/[.\-_]/g, '')];
  for (const b of BRANDS) {
    if (isOfficial(host, b.official)) return null;
    const hit = b.tokens.some((t) =>
      words.has(t) ||
      // long brand names also count when glued to other words (kasikornbank-secure, thaipostservice)
      (t.length >= 6 && joined.some((j) => j.includes(t))) ||
      // short tokens glued to a word we know scammers add (scbonline, ktbverify)
      (t.length < 6 && joined.some((j) => new RegExp('^' + t + '(?:online|secure|verify|th|thai|login|app|bank|service|support|update|official|help)|(?:my|secure|verify|login|th)' + t + '$').test(j))),
    );
    if (hit) return { name: b.name };
  }
  return null;
}

const MAXQ = 80;
const clip = (s: string) => (s.length > MAXQ ? s.slice(0, MAXQ) : s);

export function analyzeUrl(rawInput: string): UrlAnalysis {
  const raw = rawInput.trim();
  const findings: UrlFinding[] = [];
  const quote = clip(raw);
  const add = (f: Omit<UrlFinding, 'quote'>) => { if (!findings.some((x) => x.id === f.id)) findings.push({ ...f, quote }); };

  let candidate = raw.replace(/^hxxp/i, 'http');
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate);
  if (!hasScheme) candidate = 'https://' + candidate;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { raw, parsed: false, findings };
  }
  if (!/^https?:$/.test(u.protocol) || !u.hostname || !u.hostname.includes('.') && !/^\[/.test(u.hostname)) {
    return { raw, parsed: false, findings };
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, '');

  // '@' in the authority part: everything before it is ignored by browsers.
  const authority = (raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0]) ?? '';
  if (authority.includes('@')) {
    add({ id: 'url_at_sign', signal: 'suspicious_link', weight: 3, explanation: {
      th: 'ลิงก์มีเครื่องหมาย @ ซึ่งใช้หลอกให้ดูเหมือนเว็บที่รู้จัก แต่จริงๆ พาไปเว็บอื่น',
      en: 'The link contains "@". This trick makes a link look familiar while it really goes to another site.' } });
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) {
    add({ id: 'url_ip_host', signal: 'suspicious_link', weight: 3, explanation: {
      th: 'ลิงก์ใช้ตัวเลข IP แทนชื่อเว็บ เว็บของธนาคารหรือหน่วยงานจริงไม่ทำแบบนี้',
      en: 'The link uses a number (IP address) instead of a name. Real banks and agencies do not do this.' } });
  }
  if (host.split('.').some((l) => l.startsWith('xn--'))) {
    add({ id: 'url_punycode', signal: 'lookalike_domain', weight: 3, explanation: {
      th: 'ชื่อเว็บใช้ตัวอักษรพิเศษที่หน้าตาคล้ายตัวอักษรปกติ อาจเป็นเว็บปลอมที่เลียนแบบเว็บจริง',
      en: 'The web address uses special look-alike letters. It may be a fake copy of a real site.' } });
  }
  const look = brandLookalike(host);
  if (look) {
    add({ id: 'url_brand_lookalike', signal: 'lookalike_domain', weight: 3, explanation: {
      th: `ลิงก์ใช้ชื่อ "${look.name.th}" แต่ไม่ใช่เว็บไซต์ทางการ อาจเป็นเว็บปลอม ให้เข้าแอปหรือพิมพ์เว็บทางการเอง`,
      en: `The link uses the name "${look.name.en}" but is not its official website. It may be fake. Open the official app or type the official address yourself.` } });
  }
  if (SHORTENERS.has(host) || SHORTENERS.has(registrableDomain(host))) {
    add({ id: 'url_shortener', signal: 'link_shortener', weight: 2, explanation: {
      th: 'ลิงก์ถูกย่อ จึงมองไม่เห็นว่าปลายทางคือเว็บอะไร',
      en: 'The link is shortened, so you cannot see where it really goes.' } });
  }
  const tld = host.split('.').pop() ?? '';
  if (RISKY_TLDS.has(tld)) {
    add({ id: 'url_risky_tld', signal: 'suspicious_link', weight: 2, explanation: {
      th: `ลิงก์ลงท้ายด้วย .${tld} ซึ่งมิจฉาชีพใช้บ่อย หน่วยงานไทยส่วนใหญ่ใช้ .co.th .or.th .go.th หรือ .com`,
      en: `The link ends in ".${tld}", which scammers use often. Most Thai organisations use .co.th, .or.th, .go.th or .com.` } });
  }
  if (host.split('.').length >= 5) {
    add({ id: 'url_many_subdomains', signal: 'suspicious_link', weight: 2, explanation: {
      th: 'ชื่อเว็บยาวและมีหลายส่วนผิดปกติ อาจใช้ซ่อนชื่อเว็บจริง',
      en: 'The web address has an unusual number of parts. This can hide the real site name.' } });
  }
  if (hasScheme && /^http:\/\//i.test(raw.replace(/^hxxp/i, 'http'))) {
    add({ id: 'url_no_https', signal: 'suspicious_link', weight: 1, explanation: {
      th: 'ลิงก์ไม่ใช่ https เว็บธนาคารและหน่วยงานจริงใช้ https',
      en: 'The link does not use https. Real bank and agency sites use https.' } });
  }
  if (/\.apk(?:$|[?#])/i.test(u.pathname + u.search) || /\.apk$/i.test(host)) {
    add({ id: 'url_apk', signal: 'remote_access_app', weight: 3, action: true, explanation: {
      th: 'ลิงก์นี้เป็นไฟล์ติดตั้งแอป (.apk) แอปจากลิงก์อาจควบคุมโทรศัพท์และขโมยเงินในบัญชีได้ อย่าติดตั้ง',
      en: 'This link is an app install file (.apk). Apps from links can take over your phone and bank app. Do not install it.' } });
  }
  return { raw, parsed: true, host, findings };
}
