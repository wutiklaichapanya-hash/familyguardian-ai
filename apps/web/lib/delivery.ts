// Truthful presentation of help-request delivery (Codex UX P0 #2–#5, SR-12, SR-16). Pure, unit-tested.
import type { AlertDTO, DeliveryDTO } from '@fg/shared';
import type { MessageKey } from './i18n/th';
import { STATE_VISUAL, type Tone } from './visual';

export interface DeliveryPresentation {
  /** Primary sentence (takes {name}). */
  line: MessageKey;
  chip: MessageKey;
  tone: Tone;
  icon: string;
  /** True when nothing reached a real person (simulated adapter). */
  simulated: boolean;
}

/**
 * A simulated channel never counts as delivery: simulation becomes the primary sentence and chip.
 * Exceptions are states that describe something real regardless of channel:
 * - acknowledged: the person pressed Acknowledge in the app (a recorded press);
 * - cancelled_no_consent: nothing was sent.
 */
export function deliveryPresentation(d: Pick<DeliveryDTO, 'channel' | 'state'>): DeliveryPresentation {
  const simulated = d.channel !== 'in_app';
  if (simulated && d.state !== 'acknowledged' && d.state !== 'cancelled_no_consent') {
    return { line: 'state.simulated', chip: 'chip.simulated', tone: 'neutral', icon: '🧪', simulated: true };
  }
  const v = STATE_VISUAL[d.state];
  return { line: `state.${d.state}`, chip: `chip.${d.state}`, tone: v.tone, icon: v.icon, simulated };
}

/** No recipients if the API says so or nothing was queued (SR-12: never say "sent"). */
export function hasNoRecipients(a: Pick<AlertDTO, 'noRecipients' | 'deliveries'>): boolean {
  return a.noRecipients === true || a.deliveries.length === 0;
}

export type HelpOutcome = 'no_recipients' | 'acknowledged' | 'awaiting';

export function helpOutcome(a: Pick<AlertDTO, 'noRecipients' | 'deliveries' | 'acknowledgedBy'>): HelpOutcome {
  if (hasNoRecipients(a)) return 'no_recipients';
  return a.acknowledgedBy ? 'acknowledged' : 'awaiting';
}

/** Every message key the help page can show for a given alert's status area (used by tests). */
export function helpStatusKeys(a: Pick<AlertDTO, 'noRecipients' | 'deliveries' | 'acknowledgedBy'>): MessageKey[] {
  const outcome = helpOutcome(a);
  if (outcome === 'no_recipients') return ['help.sentAt', 'help.noRecipients', 'help.setupLink', 'help.noRecipientsUrgent'];
  const keys: MessageKey[] = ['help.sentAt'];
  for (const d of a.deliveries) {
    const p = deliveryPresentation(d);
    keys.push(p.line, p.chip);
    if (p.simulated) keys.push('delivery.simulatedNote');
  }
  keys.push(outcome === 'acknowledged' ? 'help.acked' : 'help.noAck');
  if (outcome === 'acknowledged') keys.push('help.ackMeaning');
  return keys;
}
