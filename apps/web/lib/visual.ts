// Icon + tone for each status. Colour is never the only signal: every chip also has an icon and a word.
import type { DashboardStatus, Mood, NotificationState, RiskLevel } from '@fg/shared';
import type { IconName } from '../components/icons';

export type Tone = 'neutral' | 'warm' | 'alert' | 'brand';

export const MOOD_ICON: Record<Mood, IconName> = {
  happy: 'happy',
  okay: 'okay',
  lonely: 'lonely',
  worried: 'worried',
  tired: 'tired',
  prefer_not_to_answer: 'dots',
};

export const RISK_VISUAL: Record<RiskLevel, { icon: IconName; tone: Tone }> = {
  high_risk: { icon: 'stop', tone: 'alert' },
  caution: { icon: 'alert', tone: 'warm' },
  low_signals: { icon: 'info', tone: 'brand' },
  cannot_assess: { icon: 'question', tone: 'neutral' },
};

export const DASHBOARD_VISUAL: Record<DashboardStatus, { icon: IconName; tone: Tone }> = {
  // HS-03: neutral, never a green tick — it only reflects what was shared.
  no_action_needed: { icon: 'info', tone: 'neutral' },
  check_in_recommended: { icon: 'sun', tone: 'warm' },
  assistance_requested: { icon: 'handRaised', tone: 'warm' },
  verify_possible_scam: { icon: 'shieldSearch', tone: 'warm' },
  not_shared: { icon: 'lock', tone: 'neutral' },
};

export const STATE_VISUAL: Record<NotificationState, { icon: IconName; tone: Tone }> = {
  queued: { icon: 'clock', tone: 'neutral' },
  sent: { icon: 'send', tone: 'brand' },
  failed: { icon: 'refresh', tone: 'warm' },
  seen: { icon: 'eye', tone: 'brand' },
  // A recorded button press, not resolution: neutral, never a green tick.
  acknowledged: { icon: 'bell', tone: 'neutral' },
  cancelled_no_consent: { icon: 'lock', tone: 'neutral' },
};
