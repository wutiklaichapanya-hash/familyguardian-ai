import type { DashboardStatus, Mood, RiskLevel } from './domain';

export type Locale = 'th' | 'en';
type L = Record<Locale, string>;

export const DASHBOARD_LABELS: Record<DashboardStatus, L> = {
  no_action_needed: { th: 'ไม่ต้องดำเนินการ', en: 'No Action Needed' },
  check_in_recommended: { th: 'ลองทักทายดูนะ', en: 'Check In Recommended' },
  assistance_requested: { th: 'ขอความช่วยเหลือ', en: 'Assistance Requested' },
  verify_possible_scam: { th: 'ช่วยตรวจสอบข้อความ', en: 'Verify Possible Scam' },
};

export const MOOD_LABELS: Record<Mood, L> = {
  happy: { th: 'มีความสุข', en: 'Happy' },
  okay: { th: 'ก็ดี', en: 'Okay' },
  lonely: { th: 'เหงา', en: 'Lonely' },
  worried: { th: 'กังวล', en: 'Worried' },
  tired: { th: 'เหนื่อย', en: 'Tired' },
  prefer_not_to_answer: { th: 'ไม่อยากตอบ', en: 'Prefer not to answer' },
};

export const RISK_LABELS: Record<RiskLevel, L> = {
  low_signals: { th: 'ไม่พบสัญญาณเสี่ยงที่ชัดเจน — แต่ยังควรตรวจสอบ', en: 'No clear risk signals found — still verify' },
  caution: { th: 'ควรระวัง', en: 'Be careful' },
  high_risk: { th: 'เสี่ยงสูง — หยุดก่อน', en: 'High risk — stop first' },
  cannot_assess: { th: 'ประเมินไม่ได้', en: 'Cannot assess' },
};

export const NO_DATA_LABEL: L = { th: 'ยังไม่มีการเช็กอินวันนี้', en: 'No check-in yet today' };

/** Phrases that must never appear in UI copy (enforced by tests in web + shared). */
export const FORBIDDEN_PHRASES: readonly string[] = [
  'ปลอดภัยแน่นอน', 'แจ้งตำรวจแล้ว', 'เลขคดี', 'รถพยาบาลกำลังไป', 'ซึมเศร้า', 'วินิจฉัย',
  'definitely safe', 'this is safe', 'reported to police', 'case number', 'ambulance dispatched',
  'diagnosed', 'depression', 'call connected',
];
