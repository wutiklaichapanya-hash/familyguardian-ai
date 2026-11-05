import type { CheckinDTO, Mood } from '@fg/shared';

export interface TrendDay {
  /** Local date key YYYY-MM-DD */
  date: string;
  /** Latest mood recorded that day, or null when there is no data (shown neutrally, never as decline). */
  mood: Mood | null;
  onlyMe: boolean;
}

function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Build a fixed N-day window ending today (oldest first). Gaps are explicit `mood: null`. */
export function buildTrend(checkins: CheckinDTO[], days = 14, today: Date = new Date()): TrendDay[] {
  const latestByDay = new Map<string, CheckinDTO>();
  for (const c of checkins) {
    const d = new Date(c.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = localKey(d);
    const prev = latestByDay.get(key);
    if (!prev || new Date(prev.createdAt) < d) latestByDay.set(key, c);
  }
  const out: TrendDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = localKey(d);
    const c = latestByDay.get(key);
    out.push({ date: key, mood: c ? c.mood : null, onlyMe: c ? c.onlyMe : false });
  }
  return out;
}

export function isToday(iso: string | null | undefined, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && localKey(d) === localKey(now);
}
