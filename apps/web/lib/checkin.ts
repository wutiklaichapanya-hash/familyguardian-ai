// Check-in audience rules (Codex UX P0 #6, UX §1.4, HS K-12). Pure, unit-tested.
import type { CreateCheckinReq, Mood } from '@fg/shared';

export type Audience = 'only_me' | 'shared';

/** Private by default: nothing is shared unless the senior explicitly chooses to share. */
export const INITIAL_AUDIENCE: Audience = 'only_me';

/** Recipient lookup state: null = still loading, 'error' = lookup failed, string[] = eligible names. */
export type Recipients = string[] | null | 'error';

export type ShareAvailability = 'loading' | 'error' | 'nobody' | 'available';

export function shareAvailability(r: Recipients): ShareAvailability {
  if (r === null) return 'loading';
  if (r === 'error') return 'error';
  return r.length === 0 ? 'nobody' : 'available';
}

/**
 * Build the request. Sharing is only sent when the senior chose it AND the named recipients were shown;
 * otherwise it is saved for her only. The note is shared only if she ticked it and wrote one.
 */
export function buildCheckinRequest(input: {
  mood: Mood;
  note: string;
  noteShared: boolean;
  audience: Audience;
  recipients: Recipients;
}): CreateCheckinReq {
  const note = input.note.trim();
  const share = input.audience === 'shared' && shareAvailability(input.recipients) === 'available';
  return {
    mood: input.mood,
    note: note || undefined,
    onlyMe: !share,
    noteShared: share && input.noteShared && !!note,
  };
}
