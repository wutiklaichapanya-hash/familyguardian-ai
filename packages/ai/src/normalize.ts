// Text normalisation with an index map back to the original input, so that
// evidence quotes are always taken verbatim (then defanged) from what the user pasted.

export const MAX_INPUT_BYTES = 5 * 1024; // threat model: scam text ≤ 5 KB
export const MAX_QUOTE = 80;

const ZERO_WIDTH = /[​-‏‪-‮⁠-⁤﻿­͏᠎]/;
/** Combining accents and Thai phinthu, sometimes stuffed between letters to dodge filters. */
const STRAY_MARKS = /[ฺ̀-ͯ]/;

/** Cyrillic / Greek letters that look like Latin ones (kbаnk with a Cyrillic а), and Thai digits. */
const HOMOGLYPHS: Record<string, string> = {
  'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't',
  'у': 'y', 'х': 'x', 'ѕ': 's', 'і': 'i', 'ї': 'i', 'ј': 'j', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w', 'ɡ': 'g', 'ӏ': 'l',
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u',
  'χ': 'x', 'ω': 'w', 'ѡ': 'w',
  '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9',
};

/** Thai spelling tricks: two sara e (เเ) for sara ae (แ); nikhahit + sara aa for sara am (ำ). */
function fixThai(s: string): string {
  return s.replace(/เเ/g, 'แ').replace(/ํา/g, 'ำ');
}

/**
 * Normalise for matching: compatibility-decompose (folds full-width letters, strips accents),
 * drop zero-width and stray marks, lower-case, fold homoglyphs, then re-join Thai sara am
 * (NFKD splits "ำ" into nikhahit + sara aa, which would otherwise break Thai patterns).
 */
export function foldForMatching(s: string): string {
  let out = '';
  for (const c of s.normalize('NFKD')) {
    if (ZERO_WIDTH.test(c) || STRAY_MARKS.test(c)) continue;
    const low = c.toLowerCase();
    out += HOMOGLYPHS[low] ?? low;
  }
  return fixThai(out).normalize('NFC');
}

export interface NormalizedText {
  /** Folded text with whitespace runs collapsed to one space (for English patterns). */
  spaced: string;
  spacedMap: number[];
  /** Folded text with ALL whitespace removed (Thai has no word spaces; scammers write "ด่ ว น"). */
  compact: string;
  compactMap: number[];
  original: string;
}

export function normalizeText(original: string): NormalizedText {
  let spaced = '';
  const spacedMap: number[] = [];
  let compact = '';
  const compactMap: number[] = [];
  let lastWasSpace = true;
  const chars = Array.from(original);
  let i = 0;
  for (let k = 0; k < chars.length; k++) {
    let ch = chars[k] ?? '';
    const at = i;
    i += ch.length;
    const next = chars[k + 1];
    if (ch === 'เ' && next === 'เ') { ch = 'แ'; k++; i += 1; }
    else if (ch === 'ํ' && next === 'า') { ch = 'ำ'; k++; i += 1; }
    for (const c of foldForMatching(ch)) {
      if (/\s/.test(c)) {
        if (!lastWasSpace) { spaced += ' '; spacedMap.push(at); }
        lastWasSpace = true;
        continue;
      }
      lastWasSpace = false;
      spaced += c; spacedMap.push(at);
      compact += c; compactMap.push(at);
    }
  }
  return { spaced, spacedMap, compact, compactMap, original };
}

/** Cut a string to at most `maxBytes` of UTF-8 without splitting a character. */
export function capBytes(s: string, maxBytes = MAX_INPUT_BYTES): { text: string; truncated: boolean } {
  let bytes = 0;
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    const n = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (bytes + n > maxBytes) return { text: out, truncated: true };
    bytes += n;
    out += ch;
  }
  return { text: out, truncated: false };
}

/** Take a verbatim slice of the original text covering [start, end) plus a little context. */
export function sliceAround(original: string, start: number, end: number, max = MAX_QUOTE): string {
  let s = Math.max(0, start);
  let e = Math.min(original.length, Math.max(end, s + 1));
  if (e - s >= max) {
    e = s + max;
  } else {
    const extra = max - (e - s);
    const left = Math.min(15, Math.floor(extra / 2));
    const right = Math.min(15, extra - left);
    s = Math.max(0, s - left);
    e = Math.min(original.length, e + right);
    // Snap to nearby spaces so the quote does not start or end in the middle of a word.
    const sp = original.lastIndexOf(' ', start);
    if (sp >= s - 12 && sp < start && start - sp <= 15 + 12) s = sp + 1;
    else if (sp < s) { const fwd = original.indexOf(' ', s); if (fwd !== -1 && fwd < start) s = fwd + 1; }
    const ep = original.indexOf(' ', end);
    if (ep !== -1 && ep <= e) e = ep;
  }
  // Never start on a Thai combining vowel / tone mark.
  while (s < start && /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(original[s] ?? '')) s++;
  return clip(original.slice(s, e).replace(/\s+/g, ' ').trim(), max);
}

export function clip(s: string, max = MAX_QUOTE): string {
  let cps = Array.from(s);
  if (cps.length > max) cps = cps.slice(0, max);
  while (cps.join('').length > max) cps = cps.slice(0, -1);
  return cps.join('');
}

/**
 * Defang links so a quote can never be rendered as a clickable link (SR-18):
 * "https://kbank-secure.xyz" -> "hxxps://kbank-secure[.]xyz". Result stays ≤ maxLen UTF-16 units.
 */
export function defang(text: string, maxLen = Number.POSITIVE_INFINITY): string {
  const out = text.replace(/[^\s฀-๿]+/g, (tok) => {
    const looksLink =
      /^(?:https?|hxxps?|ftp):\/\//i.test(tok) || /^www\./i.test(tok) ||
      /[a-z0-9-]\.[a-z]{2}/i.test(tok) || /\d\.\d{1,3}\.\d{1,3}\.\d/.test(tok);
    if (!looksLink) return tok.replace(/http/gi, (h) => h.slice(0, 1) + 'xx' + h.slice(3));
    return tok.replace(/^http/i, 'hxxp').replace(/^ftp/i, 'fxp').replace(/\./g, '[.]').replace(/@/g, '[at]');
  });
  if (out.length <= maxLen) return out;
  return clip(out, maxLen).replace(/\[(?:\.|at?)?$/, '');
}
