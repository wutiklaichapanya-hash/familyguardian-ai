// Decorative illustrations (inline SVG, no raster assets). Always aria-hidden.

/** Brand mark: a teal heart-shaped house with a shield door and a warm heart. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bm-g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#3fb3a3" />
          <stop offset="1" stopColor="#1f6f6a" />
        </linearGradient>
        <linearGradient id="bm-s" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2a8fd0" />
          <stop offset="1" stopColor="#1d5f9a" />
        </linearGradient>
      </defs>
      {/* heart-shaped roof */}
      <path d="M24 43 6.8 26.6A10.6 10.6 0 0 1 24 12.3a10.6 10.6 0 0 1 17.2 14.3Z" fill="url(#bm-g)" />
      {/* shield door */}
      <path d="M24 40.5s9-4 9-11.3v-6.6L24 19l-9 3.6v6.6c0 7.3 9 11.3 9 11.3Z" fill="url(#bm-s)" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M24 34s-4.6-2.8-4.6-6a2.5 2.5 0 0 1 4.6-1.3 2.5 2.5 0 0 1 4.6 1.3c0 3.2-4.6 6-4.6 6Z" fill="#fff" />
    </svg>
  );
}

/** Home greeting scene: a soft sun with rays, rolling hills and a leafy sprig on the sky header. */
export function MorningArt() {
  return (
    <svg className="greet-art" viewBox="0 0 200 150" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ma-sun" cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="1" stopColor="#ffb938" />
        </radialGradient>
      </defs>
      <g stroke="#ffc53d" strokeWidth="5" strokeLinecap="round">
        <path d="M112 18v12M78 32l8 8M146 32l-8 8M66 64h12M158 64h-12" />
      </g>
      <circle cx="112" cy="68" r="28" fill="url(#ma-sun)" />
      <path d="M0 116c28-20 58-24 92-12s66 10 108-12v58H0Z" fill="var(--art-hill-1)" />
      <path d="M0 132c36-14 78-16 116-6s58 4 84-6v30H0Z" fill="var(--art-hill-2)" />
      <g fill="var(--art-leaf)">
        <path d="M178 40c-14 2-20 14-18 24 12-2 20-12 18-24Z" />
        <path d="M194 66c-12-4-24 2-26 14 12 4 24-2 26-14Z" />
        <path d="M160 74c-12-5-22-1-25 9 11 5 22 1 25-9Z" opacity="0.85" />
      </g>
      <path d="M200 22c-18 24-28 54-32 96" stroke="var(--art-stem)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* small hearts */}
      <path d="M40 46s-6-3.6-6-7.6a3.1 3.1 0 0 1 6-1.4 3.1 3.1 0 0 1 6 1.4c0 4-6 7.6-6 7.6Z" fill="#f28b9b" />
      <path d="M24 78s-4-2.4-4-5a2 2 0 0 1 4-1 2 2 0 0 1 4 1c0 2.6-4 5-4 5Z" fill="#b79bea" />
    </svg>
  );
}

/** Welcome / sign-in hero: a soft shield with a heart, two friendly faces and floating feature badges. */
export function HeroArt({ className = 'hero-art' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 260 170" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="h-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--c-blue-tint)" />
          <stop offset="0.55" stopColor="var(--c-teal-tint)" />
          <stop offset="1" stopColor="var(--c-amber-tint)" />
        </linearGradient>
        <linearGradient id="h-shield" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3b8f87" />
          <stop offset="1" stopColor="#1f5e59" />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="92" rx="122" ry="74" fill="url(#h-bg)" />
      {/* shield + heart */}
      <path d="M130 150s40-18 40-50V64l-40-15-40 15v36c0 32 40 50 40 50Z" fill="url(#h-shield)" />
      <path d="M130 120s-20-12-20-26a10.5 10.5 0 0 1 20-5 10.5 10.5 0 0 1 20 5c0 14-20 26-20 26Z" fill="#f4b24c" />
      {/* senior (left) */}
      <circle cx="58" cy="100" r="26" fill="#ffe1cc" />
      <path d="M33 96c0-18 11-28 25-28s25 10 25 28c-6-8-15-12-25-12s-19 4-25 12Z" fill="#d9dde3" />
      <circle cx="50" cy="102" r="2.4" fill="#5b4a42" />
      <circle cx="66" cy="102" r="2.4" fill="#5b4a42" />
      <path d="M50 111c5 4 11 4 16 0" stroke="#c46a58" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* family member (right) */}
      <circle cx="202" cy="100" r="26" fill="#f6d2b8" />
      <path d="M176 100c-2-20 10-32 26-32s28 12 26 32c-4-10-12-16-26-16s-22 6-26 16Z" fill="#4a3a36" />
      <circle cx="194" cy="104" r="2.4" fill="#4a3a36" />
      <circle cx="210" cy="104" r="2.4" fill="#4a3a36" />
      <path d="M194 113c5 4 11 4 16 0" stroke="#c46a58" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* floating feature badges */}
      <circle cx="78" cy="38" r="15" fill="var(--c-amber)" />
      <path d="M78 30v2M78 44v2M70 38h2M84 38h2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="78" cy="38" r="4" fill="none" stroke="#fff" strokeWidth="2.2" />
      <circle cx="186" cy="34" r="15" fill="var(--c-green)" />
      <path d="M181 29c0 6 4 10 10 10l2-2-3-3-2 1c-2-1-3-2-4-4l1-2-3-3Z" fill="#fff" />
      <circle cx="226" cy="62" r="11" fill="var(--c-rose)" />
      <path d="M226 67s-5-3-5-6.5a2.6 2.6 0 0 1 5-1.2 2.6 2.6 0 0 1 5 1.2c0 3.5-5 6.5-5 6.5Z" fill="#fff" />
      <circle cx="34" cy="58" r="10" fill="var(--c-blue)" />
      <circle cx="33" cy="57" r="3.6" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="m36 60 3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
