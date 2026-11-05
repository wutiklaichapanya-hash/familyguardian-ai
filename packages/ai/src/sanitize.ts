import { FORBIDDEN_PHRASES } from '@fg/shared';
import { defang, foldForMatching, MAX_QUOTE } from './normalize';

/** Words never used in OUR OWN copy (UX spec §8: no "safe" verdict). Quotes are handled by sanitizeQuote. */
export const OWN_COPY_BANNED: readonly string[] = [...FORBIDDEN_PHRASES, 'ปลอดภัย', 'safe'];

export function containsForbidden(s: string): boolean {
  const low = foldForMatching(s);
  return FORBIDDEN_PHRASES.some((p) => low.includes(foldForMatching(p)));
}

export function ownCopyViolations(s: string): string[] {
  const low = foldForMatching(s);
  return OWN_COPY_BANNED.filter((p) => low.includes(foldForMatching(p)));
}

const esc = (p: string) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Quotes come from untrusted input. A scammer can write "this is safe" in the message;
 * we never echo a forbidden phrase back (masked with …), and links are defanged (SR-18). ≤ 80 chars.
 */
export function sanitizeQuote(q: string): string {
  let out = q.replace(/[\u0000-\u001F\u007F]/g, ' ');
  for (const p of FORBIDDEN_PHRASES) out = out.replace(new RegExp(esc(p), 'gi'), '…');
  // Also catch forbidden phrases hidden with zero-width chars or homoglyphs.
  if (containsForbidden(out)) out = '…';
  return defang(out.trim(), MAX_QUOTE);
}

/** True if text carries a link or phone number (the explainer may never add these). */
export function containsLinkOrPhone(s: string): boolean {
  const f = foldForMatching(s);
  return (
    /(?:https?|hxxps?):\/\/|www\.|\[\.\]/.test(f) ||
    /[a-z0-9-]\.(?:com|net|org|th|me|ly|io|co|xyz|top|info|app|link|cc|id|gl|gd|at)\b/.test(f) ||
    /\d[\d\s-]{6,}\d/.test(f) || /\+\d{2,}/.test(f) || /(?<!\d)1\d{3}(?!\d)|(?<!\d)19[1-9](?!\d)/.test(f)
  );
}
