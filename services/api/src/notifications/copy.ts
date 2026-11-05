// Minimal notification copy. Never include mood, notes, messages, scam text or amounts.
import type { AlertKind, Locale } from '@fg/shared';

type L = Record<Locale, string>;
const pick = (l: L, locale: Locale) => l[locale] ?? l.th;

export function alertSummary(kind: AlertKind, seniorName: string, locale: Locale): string {
  const m: Record<AlertKind, L> = {
    user_requested_help: { th: `${seniorName} กดขอความช่วยเหลือ`, en: `${seniorName} pressed Request Help` },
    shared_scam_check: { th: `${seniorName} แชร์ผลตรวจข้อความให้คุณ`, en: `${seniorName} shared a message check with you` },
    shared_transfer_pause: { th: `${seniorName} แชร์การหยุดคิดก่อนโอนให้คุณ`, en: `${seniorName} shared a transfer pause with you` },
    shared_checkin_concern: { th: `${seniorName} อาจอยากให้ทักทาย`, en: `${seniorName} may welcome a check-in` },
  };
  return pick(m[kind], locale);
}

export function notificationCopy(kind: AlertKind, seniorName: string, locale: Locale, followUp = false): { title: string; body: string } {
  const title = followUp
    ? pick({ th: `ยังไม่มีผู้รับทราบ: ${seniorName} ขอความช่วยเหลือ`, en: `Not yet acknowledged: ${seniorName} asked for help` }, locale)
    : alertSummary(kind, seniorName, locale);
  const body = kind === 'user_requested_help'
    ? pick({ th: 'เปิดแอปเพื่อดูและกดรับทราบ', en: 'Open the app to view and acknowledge.' }, locale)
    : pick({ th: 'เปิดแอปเพื่อดูรายละเอียด', en: 'Open the app to view it.' }, locale);
  return { title, body };
}

/** Shown when content is no longer shared (revoked OR expired — deliberately identical text). */
export function revokedCopy(locale: Locale): { title: string; body: string } {
  return {
    title: pick({ th: 'การแจ้งเตือน', en: 'Notification' }, locale),
    body: pick({ th: 'เนื้อหานี้ไม่ได้แชร์แล้ว', en: 'This content is no longer shared.' }, locale),
  };
}
