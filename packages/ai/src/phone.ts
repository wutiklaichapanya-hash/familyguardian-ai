// Phone-number hints. LOW weight on purpose: caller ID can be faked, and a number
// alone never proves who is calling. We never say a caller is a criminal.
import type { Bi } from './rules';

export interface PhoneAnalysis {
  parsed: boolean;
  digits: string;
  findings: { id: string; weight: 1; quote: string; explanation: Bi }[];
  /** Known public hotline (1441, 191, 1669 …): note that caller ID can still be spoofed. */
  isShortHotline: boolean;
}

const HOTLINES = new Set(['1441', '191', '1669', '1111', '1599', '1300', '1213']);

export function analyzePhone(raw: string): PhoneAnalysis {
  const trimmed = raw.trim();
  const quote = trimmed.slice(0, 80);
  const intl = /^(?:\+|00)/.test(trimmed);
  const digits = trimmed.replace(/[^\d]/g, '');
  const findings: PhoneAnalysis['findings'] = [];
  if (digits.length < 3) return { parsed: false, digits, findings, isShortHotline: false };

  const uncertain: Bi = {
    th: 'รูปแบบเบอร์นี้ไม่ใช่เบอร์ไทยทั่วไป แต่ข้อนี้ไม่ได้บอกว่าผู้โทรเป็นใคร เบอร์โทรอาจถูกปลอมแสดงได้',
    en: 'This number does not look like a usual Thai number. This alone does not tell who is calling. Caller numbers can be faked.',
  };

  let national = digits;
  if (intl) {
    const cc = digits.replace(/^00/, '');
    if (!cc.startsWith('66')) {
      findings.push({ id: 'phone_international', weight: 1, quote, explanation: {
        th: 'เป็นเบอร์จากต่างประเทศ มิจฉาชีพบางกลุ่มโทรจากต่างประเทศ แต่คนที่คุณรู้จักก็อาจโทรจากต่างประเทศได้ ข้อนี้จึงไม่แน่นอน',
        en: 'This is an international number. Some scam groups call from abroad, but people you know may also call from abroad. This sign is uncertain.' } });
      return { parsed: true, digits, findings, isShortHotline: false };
    }
    national = '0' + cc.slice(2);
  }

  if (HOTLINES.has(national)) return { parsed: true, digits, findings, isShortHotline: true };

  const thaiMobile = /^0[689]\d{8}$/.test(national);
  const thaiLandline = /^0[2-7]\d{7}$/.test(national);
  const thaiShortCode = /^1\d{3}$/.test(national);
  if (!thaiMobile && !thaiLandline && !thaiShortCode) {
    findings.push({ id: 'phone_unusual_format', weight: 1, quote, explanation: uncertain });
  }
  // Spoof-pattern hints: "+66" followed by a leading 0 (+66 0…), or a display mixing +66 and too many digits.
  if (intl && /^(?:\+|00)\s*66\s*0/.test(trimmed)) {
    findings.push({ id: 'phone_spoof_hint', weight: 1, quote, explanation: {
      th: 'เบอร์เขียนแบบ +66 แล้วตามด้วย 0 ซึ่งผิดรูปแบบปกติ อาจเป็นเบอร์ที่ถูกปลอมแสดง แต่เราไม่แน่ใจ',
      en: 'The number is written as +66 followed by 0, which is not the normal format. It may be a faked display, but we are not sure.' } });
  }
  return { parsed: true, digits, findings, isShortHotline: false };
}

/** International numbers that appear inside a message body (not +66). */
export function findIntlNumbersInText(text: string): { raw: string; index: number }[] {
  const out: { raw: string; index: number }[] = [];
  for (const m of text.matchAll(/(?<![\w+])(?:\+|00)(?!66)\d[\d\s-]{6,16}\d/g)) out.push({ raw: m[0], index: m.index ?? 0 });
  return out;
}
