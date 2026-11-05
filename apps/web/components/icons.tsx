// FamilyGuardian line-icon set. 24×24 grid, round caps/joins, stroke = currentColor (1.9px at 24px).
// Every icon may carry "accent" strokes, drawn in var(--icon-accent) — amber by default — so large
// tile icons read as two-tone (teal + amber) while small inline icons stay single-colour.
// Icons are always decorative (aria-hidden): the adjacent text carries the meaning.
import type { CSSProperties } from 'react';

type Shape = { d?: string; c?: [number, number, number]; fill?: boolean };
type Def = { main: Shape[]; accent?: Shape[] };

const p = (d: string): Shape => ({ d });
const c = (cx: number, cy: number, r: number, fill = false): Shape => ({ c: [cx, cy, r], fill });

const SHIELD = 'M12 21.5s7.5-3.6 7.5-9.6V5.6L12 2.8 4.5 5.6v6.3c0 6 7.5 9.6 7.5 9.6Z';
const OCTAGON = 'M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2Z';
const FACE = c(12, 12, 9.5);
const HAND =
  'M18 11.5V6.8a1.8 1.8 0 0 0-3.6 0M14.4 10.5V4.6a1.8 1.8 0 0 0-3.6 0v1.6M10.8 10.6V6.4a1.8 1.8 0 0 0-3.6 0v8.1M18 9a1.8 1.8 0 1 1 3.6 0v5a7.9 7.9 0 0 1-7.9 7.9h-1.6c-2.6 0-4.3-.8-5.8-2.3l-3.3-3.3a1.8 1.8 0 0 1 2.6-2.6l1.6 1.6';

const ICONS = {
  sun: {
    main: [p('M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4')],
    accent: [c(12, 12, 4.3)],
  },
  phone: {
    main: [p('M21 16.6v2.8a1.9 1.9 0 0 1-2.1 1.9 18.8 18.8 0 0 1-8.2-2.9 18.5 18.5 0 0 1-5.7-5.7 18.8 18.8 0 0 1-2.9-8.2A1.9 1.9 0 0 1 4 2.5h2.8a1.9 1.9 0 0 1 1.9 1.6c.1.9.4 1.8.7 2.7a1.9 1.9 0 0 1-.4 2L7.8 10a15.2 15.2 0 0 0 5.7 5.7l1.2-1.2a1.9 1.9 0 0 1 2-.4c.9.3 1.8.6 2.7.7a1.9 1.9 0 0 1 1.6 1.8Z')],
    accent: [p('M14.5 2.8a7 7 0 0 1 6.2 6.2M14.5 6.2a3.6 3.6 0 0 1 3 3')],
  },
  shieldSearch: { main: [p(SHIELD)], accent: [c(11.3, 10.8, 3), p('m13.5 13 2.3 2.3')] },
  shield: { main: [p(SHIELD)] },
  pauseHand: { main: [p(HAND)], accent: [c(17.6, 17.6, 4.4), p('M16.4 16v3.2M18.8 16v3.2')] },
  handRaised: { main: [p(HAND)], accent: [p('M5.2 3.6 4 2.4M3.3 7H1.8')] },
  pill: {
    main: [p('m10.4 20.4 10-10a4.9 4.9 0 0 0-6.9-6.9l-10 10a4.9 4.9 0 0 0 6.9 6.9Z')],
    accent: [p('m8.5 8.5 7 7')],
  },
  bell: { main: [p('M6 8.5a6 6 0 0 1 12 0c0 6.5 2.8 8.5 2.8 8.5H3.2S6 15 6 8.5'), p('M10.2 20.5a2 2 0 0 0 3.6 0')] },
  users: {
    main: [p('M15.5 20.5v-1.8a3.8 3.8 0 0 0-3.8-3.8H6.3a3.8 3.8 0 0 0-3.8 3.8v1.8'), c(9, 7.5, 3.8)],
    accent: [p('M21.5 20.5v-1.8a3.8 3.8 0 0 0-2.8-3.7M15.8 3.8a3.8 3.8 0 0 1 0 7.3')],
  },
  user: { main: [c(12, 8, 4), p('M4.5 21a7.5 7.5 0 0 1 15 0')] },
  lock: { main: [p('M5.5 11h13a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2Z'), p('M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11')], accent: [p('M12 15v2.5')] },
  alert: { main: [p('M10.3 3.9 2.4 17.6a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'), p('M12 9.5v4'), c(12, 17, 0.6, true)] },
  stop: { main: [p(OCTAGON), p('M12 7.5v5'), c(12, 16, 0.6, true)] },
  check: { main: [p('M20 6.5 9.5 17 4 11.5')] },
  info: { main: [FACE, p('M12 16.5v-5'), c(12, 8, 0.6, true)] },
  question: { main: [FACE, p('M9.3 9.2a2.8 2.8 0 0 1 5.4.9c0 1.9-2.7 2.6-2.7 2.6'), c(12, 16.6, 0.6, true)] },
  clock: { main: [FACE, p('M12 6.8V12l3.4 2')] },
  eye: { main: [p('M2.2 12s3.5-6.8 9.8-6.8 9.8 6.8 9.8 6.8-3.5 6.8-9.8 6.8S2.2 12 2.2 12Z'), c(12, 12, 3)] },
  flask: { main: [p('M9 2.8h6M10 2.8v6.6L4.6 18.6A1.7 1.7 0 0 0 6 21.2h12a1.7 1.7 0 0 0 1.4-2.6L14 9.4V2.8'), p('M7.2 15h9.6')] },
  refresh: { main: [p('M20.5 12a8.5 8.5 0 1 1-2.6-6.1L20.5 8.4'), p('M20.5 3.5v4.9h-4.9')] },
  send: { main: [p('M21.5 2.5 14.8 21l-3.6-8.2L3 9.2Z'), p('M21.5 2.5 11.2 12.8')] },
  siren: {
    main: [p('M7 18v-5.5a5 5 0 0 1 10 0V18'), p('M5 21.5h14a1 1 0 0 0 1-1v-.5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v.5a1 1 0 0 0 1 1Z')],
    accent: [p('M12 2v1.5M20.5 11.5H22M2 11.5h1.5M18.6 4.9l-1 1M5.4 4.9l1 1')],
  },
  heart: { main: [p('M19.2 13.8c1.5-1.4 2.8-3.1 2.8-5.3a5.3 5.3 0 0 0-5.3-5.3c-1.7 0-2.9.5-4.7 2.2-1.8-1.7-3-2.2-4.7-2.2A5.3 5.3 0 0 0 2 8.5c0 2.2 1.3 3.9 2.8 5.3L12 21Z')] },
  home: { main: [p('M3.5 10.2 12 3l8.5 7.2v9.3a1 1 0 0 1-1 1h-4.8v-6.2H9.3v6.2H4.5a1 1 0 0 1-1-1Z')] },
  share: {
    main: [c(18, 5.5, 2.8), c(6, 12, 2.8), c(18, 18.5, 2.8)],
    accent: [p('m8.5 13.4 7 3.7M15.5 6.9l-7 3.7')],
  },
  grid: { main: [p('M4 3.5h6a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM14 3.5h6a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM4 13.5h6a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-6a.5.5 0 0 1 .5-.5ZM14 13.5h6a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5v-6a.5.5 0 0 1 .5-.5Z')] },
  mailPlus: { main: [p('M21.5 12.5V6a2 2 0 0 0-2-2h-15a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2H12'), p('m21.5 6.5-9.5 6-9.5-6')], accent: [p('M18.5 15.5v6M15.5 18.5h6')] },
  message: { main: [p('M20.5 14.8a2 2 0 0 1-2 2H7.5l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z')] },
  logout: { main: [p('M9 20.5H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4'), p('m16 16.5 4.5-4.5L16 7.5M20.5 12H9')] },
  chevronRight: { main: [p('m9 18 6-6-6-6')] },
  chevronLeft: { main: [p('m15 18-6-6 6-6')] },
  chevronDown: { main: [p('m6 9 6 6 6-6')] },
  arrowLeft: { main: [p('M19.5 12h-15M11 18.5 4.5 12 11 5.5')] },
  link: { main: [p('M10 13.5a4.6 4.6 0 0 0 6.9.5l2.8-2.8a4.6 4.6 0 0 0-6.5-6.5l-1.6 1.6'), p('M14 10.5a4.6 4.6 0 0 0-6.9-.5l-2.8 2.8a4.6 4.6 0 0 0 6.5 6.5l1.6-1.6')] },
  banknote: { main: [p('M4 6.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Z')], accent: [c(12, 12, 2.6), p('M6 12h.01M18 12h.01')] },
  smartphone: { main: [p('M8 2.5h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z'), p('M11 18.5h2')] },
  calendar: { main: [p('M5 4.5h14a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z'), p('M3 9.5h18M8 2.5v4M16 2.5v4')] },
  // Check-in moods: calm faces, never clinical.
  happy: { main: [FACE, p('M7.8 13.6s1.5 2.6 4.2 2.6 4.2-2.6 4.2-2.6'), c(9, 9.5, 0.6, true), c(15, 9.5, 0.6, true)] },
  okay: { main: [FACE, p('M8.8 14.8c1.9 1 4.5 1 6.4 0'), c(9, 9.8, 0.6, true), c(15, 9.8, 0.6, true)] },
  lonely: { main: [FACE, p('M9.3 16.3c1.6-1 3.8-1 5.4 0'), c(9, 10.8, 0.7, true), c(15, 10.8, 0.7, true)] },
  worried: { main: [FACE, p('M8.4 16c1.2-.9 2.4-.9 3.6 0s2.4.9 3.6 0'), c(9, 10.4, 0.7, true), c(15, 10.4, 0.7, true)] },
  tired: { main: [FACE, p('M7.8 10.2c.8.7 1.8.7 2.6 0M13.6 10.2c.8.7 1.8.7 2.6 0'), p('M10.5 15.3h3')] },
  chat: { main: [p('M7.9 20A9 9 0 1 0 4 16.1L2.5 21.5Z')], accent: [c(8.2, 12, 0.6, true), c(12, 12, 0.6, true), c(15.8, 12, 0.6, true)] },
  dots: { main: [FACE, c(8, 12, 0.9, true), c(12, 12, 0.9, true), c(16, 12, 0.9, true)] },
} satisfies Record<string, Def>;

export type IconName = keyof typeof ICONS;

function Shapes({ shapes, accent }: { shapes: Shape[]; accent?: boolean }) {
  return (
    <>
      {shapes.map((s, i) =>
        s.c ? (
          <circle
            key={i}
            cx={s.c[0]}
            cy={s.c[1]}
            r={s.c[2]}
            fill={s.fill ? (accent ? 'var(--icon-accent, currentColor)' : 'currentColor') : accent ? 'var(--icon-accent-fill, none)' : 'none'}
          />
        ) : (
          <path key={i} d={s.d} />
        ),
      )}
    </>
  );
}

export function Icon({
  name,
  size = 24,
  className = '',
  style,
}: {
  name: IconName;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  const def: Def = ICONS[name];
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <Shapes shapes={def.main} />
      {def.accent && (
        <g className="icon-accent" stroke="var(--icon-accent, currentColor)">
          <Shapes shapes={def.accent} accent />
        </g>
      )}
    </svg>
  );
}
