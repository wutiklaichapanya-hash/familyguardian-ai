// Codex UX review 01 — regression tests for P0 behaviour and accessibility fixes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AlertDTO, DeliveryDTO, NotificationChannel, NotificationState } from '@fg/shared';
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATES } from '@fg/shared';
import { buildCheckinRequest, INITIAL_AUDIENCE, shareAvailability } from '../lib/checkin';
import { containsPhoneNumber } from '../lib/defang';
import { deliveryPresentation, helpOutcome, helpStatusKeys } from '../lib/delivery';
import { en } from '../lib/i18n/en';
import { translate } from '../lib/i18n/format';
import { th } from '../lib/i18n/th';
import { documentTitle, ROUTE_TITLES, routeTitleKey } from '../lib/routeTitles';
import { STATE_VISUAL } from '../lib/visual';

const ROOT = join(__dirname, '..');

function pageRoutes(dir = join(ROOT, 'app')): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...pageRoutes(p));
    else if (name === 'page.tsx') {
      const rel = relative(join(ROOT, 'app'), dir).split(sep).join('/');
      out.push(rel ? `/${rel}` : '/');
    }
  }
  return out.sort();
}

describe('per-route document titles (WCAG 2.4.2)', () => {
  const routes = pageRoutes();

  it('finds the app routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(16);
  });

  it.each(routes)('%s has a localised title in both languages', (route) => {
    const key = ROUTE_TITLES[route];
    expect(key, `missing ROUTE_TITLES['${route}']`).toBeDefined();
    expect(th[key!].trim()).not.toBe('');
    expect(en[key!].trim()).not.toBe('');
  });

  it('titles are distinct per route and not just the app name', () => {
    for (const locale of ['th', 'en'] as const) {
      const t = (k: keyof typeof th) => translate(locale, k);
      const titles = routes.map((r) => documentTitle(r, t));
      expect(new Set(titles).size).toBe(titles.length);
      for (const title of titles) expect(title).not.toBe('FamilyGuardian');
    }
  });

  it('resolves dynamic alert routes and trailing slashes', () => {
    expect(routeTitleKey('/alerts/4b1c')).toBe('alert.title');
    expect(routeTitleKey('/checkin/')).toBe('home.tile.checkin');
    expect(routeTitleKey('/nope')).toBeNull();
  });

  it('the root layout sets no generic metadata title and AppShell renders <title>', () => {
    const layout = readFileSync(join(ROOT, 'app/layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/^\s*title\s*:/m);
    const shell = readFileSync(join(ROOT, 'components/AppShell.tsx'), 'utf8');
    expect(shell).toContain('<title>{documentTitle(pathname, t)}</title>');
  });
});

// "Sent"/delivered vocabulary that must never describe a simulated or no-recipient outcome.
const SENT_WORDS = [/\bsent\b/i, /\bdelivered\b/i, /ส่งแล้ว/, /ส่งการแจ้งเตือน.*แล้ว/, /ส่งถึง.*แล้ว/, /ส่งให้.*แล้ว/];
const sentHits = (s: string) => SENT_WORDS.filter((re) => re.test(s)).map(String);

function alertWith(deliveries: Pick<DeliveryDTO, 'channel' | 'state'>[], extra: Partial<AlertDTO> = {}): AlertDTO {
  return {
    id: 'a1', seniorId: 's1', seniorName: 'สมศรี', kind: 'user_requested_help', origin: 'user_requested', summary: '',
    createdAt: '2026-11-05T07:00:00Z', acknowledgedBy: null,
    deliveries: deliveries.map((d, i) => ({
      notificationId: `n${i}`, recipientId: `r${i}`, recipientName: 'นก', attempts: 1, updatedAt: '2026-11-05T07:00:00Z', ...d,
    })),
    ...extra,
  };
}

describe('help page never says "sent" for simulated or no-recipient states', () => {
  const simulatedChannels = NOTIFICATION_CHANNELS.filter((c) => c !== 'in_app');

  it.each(
    simulatedChannels.flatMap((channel) =>
      NOTIFICATION_STATES.filter((s) => s !== 'acknowledged' && s !== 'cancelled_no_consent').map((state) => [channel, state] as const),
    ),
  )('%s / %s is presented as simulation only', (channel, state) => {
    const p = deliveryPresentation({ channel, state });
    expect(p.simulated).toBe(true);
    expect(p.line).toBe('state.simulated');
    expect(p.chip).toBe('chip.simulated');
  });

  it.each(['th', 'en'] as const)('no-recipient and simulated help text (%s) contains no "sent" wording', (locale) => {
    const cases: AlertDTO[] = [
      alertWith([], { noRecipients: true }),
      alertWith([]), // deliveries [] without the flag is also "no recipients"
      ...simulatedChannels.flatMap((channel) =>
        (['queued', 'sent', 'seen', 'failed'] as NotificationState[]).map((state) => alertWith([{ channel, state }])),
      ),
    ];
    for (const a of cases) {
      for (const key of helpStatusKeys(a)) {
        const text = translate(locale, key, { name: 'นก', time: '14:32', names: 'นก' });
        expect(sentHits(text), `${locale} ${key}: "${text}"`).toEqual([]);
      }
    }
  });

  it('no recipients is its own outcome, never "awaiting acknowledgement"', () => {
    expect(helpOutcome(alertWith([], { noRecipients: true }))).toBe('no_recipients');
    expect(helpOutcome(alertWith([]))).toBe('no_recipients');
    expect(helpOutcome(alertWith([{ channel: 'in_app', state: 'sent' }]))).toBe('awaiting');
  });

  it('only real in-app delivery may use the approved "sent" sentence', () => {
    expect(deliveryPresentation({ channel: 'in_app', state: 'sent' }).line).toBe('state.sent');
    // A recorded Acknowledge press is real whatever the channel; it is neutral, not a green tick.
    const ack = deliveryPresentation({ channel: 'email_simulated' as NotificationChannel, state: 'acknowledged' });
    expect(ack.line).toBe('state.acknowledged');
    expect(STATE_VISUAL.acknowledged.tone).toBe('neutral');
  });

  it('the help page reads delivery through the truthful helpers, not raw state keys', () => {
    const src = readFileSync(join(ROOT, 'app/help/page.tsx'), 'utf8');
    expect(src).toContain('helpOutcome');
    expect(src).not.toMatch(/state\.sent|chip\.sent/);
    const list = readFileSync(join(ROOT, 'components/DeliveryList.tsx'), 'utf8');
    expect(list).toContain('deliveryPresentation');
  });

  it('acknowledgement copy describes a button press, and help keeps call options after it', () => {
    expect(th['help.acked']).toContain('กดรับทราบ');
    expect(en['help.acked']).toMatch(/pressed Acknowledge/);
    const src = readFileSync(join(ROOT, 'app/help/page.tsx'), 'utf8');
    // The alternatives section is unconditional (not inside an acknowledgedBy/noRecipients branch).
    expect(src).toContain('aria-labelledby="help-alt-h"');
    expect(src).not.toMatch(/\(noRecipients \|\| !alert\.acknowledgedBy\) &&/);
  });
});

describe('check-in defaults to "only me"', () => {
  it('initial audience is private', () => {
    expect(INITIAL_AUDIENCE).toBe('only_me');
  });

  it('the default request shares nothing, even with eligible recipients and a ticked note', () => {
    const req = buildCheckinRequest({ mood: 'okay', note: 'hello', noteShared: true, audience: INITIAL_AUDIENCE, recipients: ['นก'] });
    expect(req).toEqual({ mood: 'okay', note: 'hello', onlyMe: true, noteShared: false });
  });

  it('sharing is only sent when chosen AND named recipients were shown', () => {
    const base = { mood: 'happy' as const, note: '', noteShared: false, audience: 'shared' as const };
    expect(buildCheckinRequest({ ...base, recipients: ['นก'] }).onlyMe).toBe(false);
    expect(buildCheckinRequest({ ...base, recipients: null }).onlyMe).toBe(true);
    expect(buildCheckinRequest({ ...base, recipients: 'error' }).onlyMe).toBe(true);
    expect(buildCheckinRequest({ ...base, recipients: [] }).onlyMe).toBe(true);
  });

  it('a note is shared only when sharing, ticked and non-empty', () => {
    const r = buildCheckinRequest({ mood: 'tired', note: '  ', noteShared: true, audience: 'shared', recipients: ['นก'] });
    expect(r.noteShared).toBe(false);
    expect(r.note).toBeUndefined();
  });

  it('availability states', () => {
    expect(shareAvailability(null)).toBe('loading');
    expect(shareAvailability('error')).toBe('error');
    expect(shareAvailability([])).toBe('nobody');
    expect(shareAvailability(['นก'])).toBe('available');
  });

  it('the page starts from INITIAL_AUDIENCE and has no inverse "only me" checkbox', () => {
    const src = readFileSync(join(ROOT, 'app/checkin/page.tsx'), 'utf8');
    expect(src).toContain('useState<Audience>(INITIAL_AUDIENCE)');
    expect(src).not.toContain('id="onlyMe" type="checkbox"');
    expect(src).toContain('type="radio"\n                name="audience"');
  });
});

describe('copy corrections (Codex §3)', () => {
  it('Guardian Pause lower-risk result gives no permission to transfer', () => {
    for (const s of [th['pause.careTitle'], th['pause.careBody']]) expect(s).not.toMatch(/โอนได้/);
    for (const s of [en['pause.careTitle'], en['pause.careBody']]) expect(s).not.toMatch(/go ahead|okay to|can transfer/i);
  });
  it('call feedback never claims a call started', () => {
    for (const k of ['contacts.started', 'emergency.started', 'alert.callStarted'] as const) {
      expect(th[k]).not.toContain('เริ่มโทร');
      expect(en[k]).not.toMatch(/call started/i);
    }
  });
});

describe('phone numbers in untrusted text', () => {
  it('detects phone-like runs but not short numbers', () => {
    expect(containsPhoneNumber('โทร 081-000-0001 ด่วน')).toBe(true);
    expect(containsPhoneNumber('+66 81 000 0001')).toBe(true);
    expect(containsPhoneNumber('โอน 25,000 บาท ภายใน 2 ชม.')).toBe(false);
  });
});

describe('language toggle reflow at 320px (WCAG 1.4.10, QA F-2)', () => {
  const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');
  const rule = (selector: string) => {
    const m = css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
    return m ? m[2]! : '';
  };

  it('.lang wraps and does not clip (no overflow:hidden, no fixed width)', () => {
    const lang = rule('.lang');
    expect(lang).toMatch(/flex-wrap:\s*wrap/);
    expect(lang).not.toMatch(/overflow:\s*hidden/);
    expect(lang).toMatch(/max-inline-size:\s*100%/);
  });

  it('large buttons have no em-based minimum width that forces overflow', () => {
    const large = rule('.lang-large .lang-btn');
    expect(large).not.toMatch(/min-width:\s*\d/);
    expect(large).toMatch(/min-inline-size:\s*0/);
    expect(large).toMatch(/flex:\s*1 1 7rem/);
    // 7rem at the 20px senior base = 140px; two buttons + 8px gap = 288px, which fits the 288px
    // content box at a 320px viewport, and flex-wrap stacks them if text is enlarged.
    expect(2 * 7 * 20 + 8).toBeLessThanOrEqual(320 - 2 * 16);
  });

  it('senior navigation targets are 56px', () => {
    expect(css).toMatch(/html\[data-audience='senior'\] :is\([^)]*\.lang-btn[^)]*\)\s*\{[^}]*min-block-size:\s*var\(--target\)/);
    expect(css).toMatch(/--target:\s*56px/);
  });
});
