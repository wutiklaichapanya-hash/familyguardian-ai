# @fg/web — FamilyGuardian AI web app (PWA)

Next.js 16 (App Router, React 19, TypeScript), mobile-first. It has no UI framework, just plain CSS tokens in `app/globals.css`.
**Demo only. All data is fictional.** Thai copy is a draft and still needs native-speaker and older-adult review (A9).

## Run
```bash
pnpm dev:api                    # API on :4100 (services/api)
pnpm dev:web                    # web on :3100 → http://localhost:3100
pnpm --filter @fg/web typecheck
pnpm --filter @fg/web test      # copy/forbidden-phrase + i18n parity + unit tests
pnpm --filter @fg/web build
```
Env:
- `API_BASE_URL` (default `http://localhost:4100`) is the rewrite target.
- `NEXT_PUBLIC_DEMO_MODE=false` hides the demo-account fill buttons on `/login`.

## Architecture
- **Same-origin proxy:** `next.config.ts` rewrites `/api/v1/:path*` to `${API_BASE_URL}/api/v1/:path*`, so the httpOnly session cookie is first-party. `/api/v1/*` responses get `Cache-Control: no-store`.
- **One typed client:** `lib/api.ts` uses the types from `@fg/shared` (contract v0.2). Every non-GET request sends `x-fg-csrf: 1`. Every request uses `credentials: 'include'` and `cache: 'no-store'`.
- **Pages are client components.** They fetch through the proxy after `GET /auth/me`. `components/ui.tsx#RequireRole` picks the UI by role, but the API is the only authority.
- **Session:** `lib/session.tsx`. Logout calls `POST /auth/logout`, clears `sessionStorage` and the Cache Storage, and then hard-reloads `/`.
- **i18n:** strings live in `lib/i18n/th.ts` (primary) and `lib/i18n/en.ts`. Both are typed by the same `MessageKey`, and a test checks key and placeholder parity. `{p}` is replaced by ค่ะ/ครับ from `user.politeParticle`. Status vocabulary comes from `@fg/shared` (`DASHBOARD_LABELS`, `MOOD_LABELS`, `RISK_LABELS`, `NO_DATA_LABEL`). A language chosen on the device (localStorage `fg-locale`) wins over `user.locale`.
- **Design tokens** follow UX spec §3 as CSS custom properties, with dark mode via `prefers-color-scheme`. Base size is 20px for seniors and 18px for family/caregiver/admin (`html[data-audience]`, in `%` so the OS text size is respected). Targets are at least 56px and line-height is 1.6. Red (`--alert`) is used only for high-risk scam results, the stop-and-verify pause, and emergency/1669 buttons.
- **Font:** Noto Sans Thai via `next/font/google`. It is downloaded at build time and self-hosted. CSS falls back to a system Thai stack (`Sarabun`, `Leelawadee UI`, `Thonburi`, system-ui). If the build machine is offline, `next/font` can fail the build. Swapping to the system stack only means removing the import in `app/layout.tsx`.
- **PWA:** `app/manifest.ts` (lang `th`) and `public/icon.svg`. There is deliberately **no service worker**, so nothing that holds personal data is ever cached.

## Safety and accessibility rules implemented
- No "safe" verdicts. `RISK_LABELS` is used verbatim, and every result shows the uncertainty plus "not a confirmation from any agency".
- Scam evidence quotes and submitted text are **defanged** (`lib/defang.ts`: `hxxp`, `example[.]com`, `[@]`). They render as plain text and never as links. `<meta name="format-detection" content="telephone=no">` is set. The URL field is `type="text"`.
- Calls are always `<a href="tel:…">`. They log `call_started_from_app`, and the UI says "เริ่มโทรจากแอป" and that the app cannot know whether the call went through.
- Help requests show real delivery states (polled every 5 s) with simulated channels labelled "จำลอง (ทดสอบ)". `noRecipients` shows "ยังไม่มีใครถูกตั้งให้รับคำขอนี้" with a link to /privacy and 1669, and **never** "sent".
- `/emergency` works without login and without the API. It uses the built-in fallback 1669/191/1441/1300, always badged "รอการยืนยันข้อมูล". Bank numbers are shown only when `verification === 'verified'`.
- Family dashboard: the "No Action Needed" chip is neutral (no green tick, HS-03) and always carries the caption "จากข้อมูลที่แชร์กับคุณเท่านั้น". A missing check-in shows `NO_DATA_LABEL` neutrally. `not_shared` and zero grants show "ยังไม่มีข้อมูลที่แชร์กับคุณ". Transfer pauses show the amount bucket only.
- Check-in: equal-weight 6 moods with icon + word, and a neutral confirmation ("บันทึกแล้ว · แชร์กับ: …"). The help footer (1669 / call someone you trust) is **static and identical for every answer** (HS-02). The history is a list of entries with "ไม่มีข้อมูล" gaps, with no chart, score or slope (HS-04).
- Invites use links only (no spoken codes, SR-08/09). The token is placed in the URL **fragment**, removed from the address bar on arrival, and sent in the POST body only. The senior confirms pending members, removes members and grants `checkins`/`scam_checks`/`transfer_pauses` with a password step-up dialog.
- WCAG 2.2 AA: skip link, one `h1` per page, landmarks, visible `:focus-visible` ring, labelled controls, `fieldset/legend` for choices, errors tied by `aria-describedby`, `role=status`/`aria-live` for results, native `<dialog>` for confirmations, and no colour-only meaning (icon + word on every chip). Layout reflows at 320px / 200% zoom, with no `maximum-scale`.

## Tests (`test/`)
- `copy.test.ts` checks th/en key and placeholder parity. It scans every i18n string, the shared labels, and all of `app/`, `components/` and `lib/` for `FORBIDDEN_PHRASES` plus web-local additions (HS-09 block list, SR-20 list, "ปลอดภัย", `\bsafe\b`, "connected"). Text is normalised first (NFC, zero-width stripped). It also checks for no `dangerouslySetInnerHTML`.
- `lib.test.ts` covers particle and interpolation, the 14-day history with explicit gaps, and defang.
