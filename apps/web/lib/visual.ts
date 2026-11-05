// Icon + tone for each status. Colour is never the only signal: every chip also has an icon and a word.
import type { DashboardStatus, Mood, NotificationState, RiskLevel } from '@fg/shared';

export type Tone = 'neutral' | 'warm' | 'alert' | 'brand';

export const MOOD_ICON: Record<Mood, string> = {
  happy: '😊',
  okay: '🙂',
  lonely: '🫂',
  worried: '😟',
  tired: '😴',
  prefer_not_to_answer: '💬',
};

export const RISK_VISUAL: Record<RiskLevel, { icon: string; tone: Tone }> = {
  high_risk: { icon: '⛔', tone: 'alert' },
  caution: { icon: '⚠️', tone: 'warm' },
  low_signals: { icon: 'ℹ️', tone: 'brand' },
  cannot_assess: { icon: '❔', tone: 'neutral' },
};

export const DASHBOARD_VISUAL: Record<DashboardStatus, { icon: string; tone: Tone }> = {
  // HS-03: neutral, never a green tick — it only reflects what was shared.
  no_action_needed: { icon: 'ℹ', tone: 'neutral' },
  check_in_recommended: { icon: '👋', tone: 'warm' },
  assistance_requested: { icon: '🙋', tone: 'warm' },
  verify_possible_scam: { icon: '🔍', tone: 'warm' },
  not_shared: { icon: '–', tone: 'neutral' },
};

export const STATE_VISUAL: Record<NotificationState, { icon: string; tone: Tone }> = {
  queued: { icon: '⏳', tone: 'neutral' },
  sent: { icon: '📨', tone: 'brand' },
  failed: { icon: '↻', tone: 'warm' },
  seen: { icon: '👁', tone: 'brand' },
  // A recorded button press, not resolution: neutral, never a green tick.
  acknowledged: { icon: '👆', tone: 'neutral' },
  cancelled_no_consent: { icon: '–', tone: 'neutral' },
};
