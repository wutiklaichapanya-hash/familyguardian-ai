# FGAI-2026-001 — Independent QA Report #01 (E2E, API contract, accessibility, safety copy)

| Field | Value |
|---|---|
| QA agent | Independent QA Agent. Did not build services/api or apps/web; edited only `tests/e2e/**` and `docs/qa/**` |
| Date | 2026-11-05 |
| Under test | services/api (Fastify, :4100) and apps/web (Next.js 16, :3100, proxying `/api/v1`) as they were in the working tree at about 20:36 (+07) |
| Basis | CONTRACT v0.2 (`packages/shared/src/api.ts`, `domain.ts`, `labels.ts`), `docs/product/01_DISCOVERY_AND_SCOPE.md` §4, `docs/product/05_BACKLOG_QA_GATES.md` §9, `docs/safety/SECURITY_REVIEW_01_design.md` |
| Command | `pnpm test:e2e` (= `playwright test -c tests/e2e/playwright.config.ts`), Chromium only, 1 worker, 0 retries. Global setup runs `pnpm db:migrate && pnpm db:seed` |
| Data | Synthetic demo seed only |

## 1. Result (actual, final run)

**227 tests: 225 passed, 2 failed, 0 skipped, 0 flaky.** Duration 2.1 min. Exit code 1.

The final run used the default config: Playwright started `pnpm dev:api` and `pnpm dev:web` itself. Source: the `list` reporter output and `tests/e2e/test-results/results.json` → `{"expected":225,"skipped":0,"unexpected":2,"flaky":0}`.

| Area | Spec files | Tests | Pass | Fail |
|---|---|---|---|---|
| API contract and authz (`tests/e2e/api/`) | 7 | 152 | 151 | 1 |
| UI journeys, one per AC (`tests/e2e/ui/`) | 8 | 19 | 19 | 0 |
| Accessibility: axe, keyboard, 320 px (`tests/e2e/a11y/`) | 2 | 42 | 41 | 1 |
| Forbidden-phrase sweep (`tests/e2e/safety/`) | 1 | 14 | 14 | 0 |

### Run history (for honesty)
| Run | Outcome | Why |
|---|---|---|
| 1 | 52 passed, many failed, 139 did not run | Environment and suite problems, not product failures. (a) `tsx watch` restarted the API 3 times during the run because other agents were editing `services/api`, which caused `ECONNREFUSED`. (b) The suite logged in once per spec, which tripped the **login rate limit (5/min per IP+email)**, a correct product control. Fix in the suite: cache sessions per role and re-validate them (`helpers.ts`), and raise only the *global* limit (`RATE_LIMIT_GLOBAL_MAX=5000`, env of the Playwright-started API). The login limit stays at its default |
| 2 | 207 passed / 9 failed / 11 not run | 6 failures were **test-selector bugs** (my regexes did not match the shipped copy). 3 were real. Details below |
| 3 | 220 / 2 / 5 not run | Selectors fixed (accessible names only; no expectation was weakened). Invite flow reworked (see §4) |
| 4 (final) | **225 / 2 / 0** | Same as run 3. `07-help-requests` is no longer serial, so one failure no longer hides 5 tests |

Selectors I changed after run 2 (to match the real accessible names; **the asserted behaviour did not change**): the check-in confirmation is now matched as `role=status` containing "บันทึก…แล้ว" (the app says "บันทึกแล้วค่ะ", not "บันทึกเช็กอินแล้ว"); the trend heading is "บันทึกของฉัน — ประวัติการเช็กอิน 14 วัน"; "Ask family" is a region with member checkboxes, not a single button; and the AC-8 "never sent" regex no longer matched the static help intro "ส่งการแจ้งเตือนถึงคนที่คุณไว้ใจ…". The invite test was wrongly using the admin account as the invitee: the API correctly refuses admin (`INVITE_INVALID`, role check). It now re-invites Anan instead (§4).

## 2. Failures

| # | Test | Maps to | Severity | Steps to reproduce | Evidence |
|---|---|---|---|---|---|
| F-1 | `api/07-help-requests.spec.ts` › "Nok acknowledges -> senior sees acknowledgedBy Nok (AC-8)" | AC-8, S-07, F-04; contract `DeliveryDTO.state` / `NOTIFICATION_STATES` | **Medium** | 1. As Somsri `POST /api/v1/me/help-requests` `{message}` (x-fg-csrf: 1). 2. As Nok `POST /api/v1/alerts/:id/ack` → 200, `acknowledgedBy` = Nok ✔. 3. As Somsri `GET /api/v1/me/alerts`: Nok's delivery `state` should be `acknowledged`. Polled for 10 s | `Expected: "acknowledged" Received: "sent"` after a 10 s poll. `alert.acknowledgedBy` is set correctly and the senior UI shows "นก รับทราบแล้ว" (the AC-8 UI journey passes), but the per-recipient delivery state stays `sent`. S-07 requires real states (Queued → Sent → Seen/Acknowledged), and a stale per-recipient state contradicts the alert-level ack. In run 2 the same state was still `queued` immediately after the ack |
| F-2 | `a11y/keyboard-and-reflow.spec.ts` › "320px anon /" | UX spec §2 (WCAG 2.2 AA, 1.4.10 Reflow); AC-3 accessibility | **Medium** | Open `http://localhost:3100/` logged out at a 320×640 viewport | `scrollWidth 359 > clientWidth 320; offenders: div.lang.lang-large, button.lang-btn`. The large language toggle on the Welcome page forces horizontal scrolling. All other 15 screens tested at 320 px (anon `/login` and `/emergency`, all 9 senior screens, 4 Nok screens) pass |

No Critical or High failures.

## 3. What passed (key assertions)

**Authorization matrix** (`api/02-authz-matrix.spec.ts`). 21 endpoint cases × Somsri/Nok/Anan/Pim/Admin, all as specified:
- Senior-only reads (`/me/members` → 404 for every other role; `/me/invitations`, `/me/access-log` → 403/404).
- Senior-only writes (invitations, grants, grant revoke, member removal, check-ins, contacts, help requests, share) → 403/404 for every other role. The denied destructive calls had no effect: Nok is still a member and keeps her grant, and Anan still has 0 grants.
- `/seniors/:id/{checkins,scam-checks,guardian-pause}`: only Nok is allowed. Anan, Pim and Admin are denied.
- Unknown senior or alert ids → 404 for every role. `/admin/overview` is admin-only.
- No denial body contains mood, note, evidence, amount or deliveries.
- Grantees see only their own active grants and never `revokedAt` (SR-07).

**Zero-grant viewer (SR-01, SR-03).** Anan's card is `status: 'not_shared'`, `visibleCategories: []`, with no check-in, alerts, scam or pause data and `lastUpdatedAt` null. It stays `not_shared` after the senior's activity. Anan gets no alert for a help request.

**Caregiver (C-01, CAREGIVER_FORBIDDEN).**
- Pim is denied scam and pause reads.
- Pim's card has no scam, pause or checkins category and never `verify_possible_scam`.
- A grant of `scam_checks` or `transfer_pauses` to Pim is refused with **403** even with step-up.
- Sharing a scam check or pause with Pim is refused with 400.

**Admin (AD-01).** `/admin/overview` has counts-only keys and no names, emails, notes or scam text. Every senior content endpoint is denied. `circles: []`.

**onlyMe (SR-02/SR-03).**
- An onlyMe check-in is absent from Nok's list and the row count is unchanged.
- `lastUpdatedAt`, `latestCheckin` and `status` on the dashboard are unchanged.
- Shared rows carry no `onlyMe` or `noteShared` keys, and a non-shared note is omitted.

**Per-recipient share (SR-04).**
- A share is refused with 400 for Anan, a random id, admin, or a mixed list [Nok, Anan]. A mixed list is rejected whole and Nok does not get the item.
- The error does not name the user.
- A pause shared to Nok shows `amountBucket: '50k_200k'`, with no `amountThb` and no `recipientNote`.

**Revoke (F-03, SR-07).**
- After a revoke, Nok's next read of the category is 404. The alert read and ack are 404. The alert is removed from `/alerts`.
- The notification becomes `contentUnavailable: true`, with no item detail and no revoke wording.
- The 404 error code for "revoked" equals the one for "never existed". Re-granting restores access.
- A sensitive grant without the password, or with a wrong one, is refused.

**Invite (SR-08/09/11).**
- The token is returned once, has at least 128 bits and is not a numeric code. It is never listed again and never sent in the query string.
- Accept gives `pending_confirmation` with 0 grants and no data. The senior sees `acceptedByAccountName`.
- The token is single-use (the second accept and an accept by another account both fail). Bad tokens fail, and a token in the query string fails.
- Confirm without a password, or with a wrong one, is refused. A non-senior cannot confirm.
- Confirm with the password gives an active member with `activeGrants: []` and `not_shared`. A cancelled invite cannot be accepted.

**Help requests (SR-06, SR-12).**
- With no `help_requests` grantee: `noRecipients: true`, `deliveries: []`, nothing reads "sent", and nobody receives it.
- The recipient view holds only the caller's own delivery.
- The grant is re-checked on read and ack (404 after a revoke).
- Call log: `call_started_from_app`, never "connected". A phone number supplied by the client is ignored.
- Directory entries for 1669/191/1441 are `needs_human_verification` unless verified.

**CSRF and login.**
- Login without `x-fg-csrf` is refused and creates no session.
- An authenticated POST or DELETE without the header, or with a wrong value, is refused and creates no record.
- An unknown email and a wrong password get identical status and `{code,message}`.
- Unauthenticated reads → 401. Errors use the `{error:{code,message}}` shape. `Cache-Control: no-store` is set (SR-14).

**UI journeys** (all pass):
- **AC-3:** form login → Home with 4–6 tiles → tile, mood, save (3 taps) → confirmation. The trend shows the entry, gaps show "ไม่มีข้อมูล", and there is no decline wording. "Only me" works.
- **AC-4:** Nok sees an approved status label and the shared check-in, but not the onlyMe note. Anan sees "ยังไม่มีข้อมูลที่แชร์กับคุณ" with no moods or timestamps. Pim sees no scam/pause sections. Nok on `/privacy` sees no other members.
- **AC-5:** the Thai fake-bank SMS gives "เสี่ยงสูง — หยุดก่อน" with 5 quoted reasons (OTP, threat, look-alike domain, impersonation, urgency), an uncertainty section, steps, ask-family and `tel:1441`. "ปลอดภัย" and "safe" never appear in the result. The scam URL is defanged (`hxxps://kbank-verify-th[.]com`) and not a link. A benign message gets an approved label with no "safe" verdict.
- **AC-6:** ฿80,000 with answers no/yes/yes/no gives "หยุดก่อน และตรวจสอบให้แน่ใจ" and "หยุดและตรวจสอบ". The "no bank connection" note is visible, along with the call-someone-you-trust action and `tel:1441`. There is no "blocked" claim.
- **AC-7:** the contact is `<a href="tel:…">`. A click shows "เริ่มโทรจากแอป" and logs `call_started_from_app`. "connected" never appears.
- **AC-8:** help, then Nok acknowledges in her own browser, then Somsri's page shows "นก … รับทราบแล้ว". The page says no agency is notified. With no recipients the UI shows "ยังไม่มีใครถูกตั้งให้รับคำขอนี้" and `tel:1669`, and never a sent state.
- **AC-9:** "หยุดแชร์การเช็กอินกับ นก" on `/privacy` → confirmation → Nok's API returns 404 and the check-ins vanish from her dashboard on reload. The revoke is not announced to Nok.
- **AC-11:** `/emergency` works logged out and shows `tel:1669`, `tel:191` and `tel:1441`, "แอปไม่ได้แจ้งหน่วยงานให้อัตโนมัติ" and verification badges. No forbidden phrase, case-number pattern or agency acknowledgement appears before or after tapping. The login page links to it.

**Keyboard.** The senior check-in can be completed with Tab, Space and Enter only, with a visible focus indicator. The skip link is the first focusable element.

**Forbidden phrases.** 12 crawls (6 role sets × th and en, following same-origin links up to 30 pages each) plus the scam-result and help-sent screens in both locales found **0 occurrences** of the 16 `FORBIDDEN_PHRASES`.

## 4. Accessibility: axe-core summary

`@axe-core/playwright` with tags wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa ran on **24 screen×role combinations**:
- anon: `/`, `/login`, `/emergency`
- Somsri: `/home`, `/checkin`, `/contacts`, `/scam-check`, `/guardian-pause`, `/help`, `/emergency`, `/privacy`, `/notifications`
- Nok: `/family`, `/notifications`, `/invite/accept`, `/emergency`
- Anan: `/family`, `/notifications`, `/emergency`
- Pim: `/family`, `/notifications`, `/emergency`
- admin: `/admin`, `/emergency`

**Result: 0 violations of any impact (0 critical, 0 serious, 0 moderate, 0 minor).** Raw rows are in `tests/e2e/test-results/axe-summary.json`.

Limits: axe does not cover screen-reader announcements, 200 % zoom, colour meaning, or Thai comprehension by older adults. A manual VoiceOver pass and older-adult copy review are still required (QA §9, assumption A9).

## 5. Not covered / known gaps in this suite
- **Invitee account:** the seed has no spare family/caregiver user outside Somsri's circle. The invite spec therefore removes Anan (with step-up), re-invites him through the full flow and leaves him as a confirmed zero-grant member, which is the seeded state. It does not test a stranger joining.
- Not tested:
  - 5-failed-attempt invite invalidation
  - the 72 h TTL
  - Clear-Site-Data / Back-after-logout (SR-14)
  - progressive login delay
  - session rotation after step-up
  - `/billing`, `/alerts/[id]` (axe), and the admin directory editor (P1)
- SR-13 says "member without grant → 403", while the v0.2 header and this brief say 404 for invisible resources. The suite accepts 403 or 404 for a grantless member on `/seniors/:id/*`, and requires **404** after a revoke and for unknown ids. The API returned 404 for every one of these cases.
- The final run used `pnpm dev:api` (watch mode). Edits by other agents during a run can restart the API (run 1). `FG_E2E_API_CMD='pnpm --filter @fg/api start'` gives a stable server (runs 2–3).
- Login rate limit: the suite reuses one session per role (`tests/e2e/.auth/`, git-ignored, cleared by global setup). If the limit is hit anyway, it waits 61 s and retries.

## 6. Requests to other owners (no code changed by QA)
1. **Backend:** on ack, update the acknowledging recipient's delivery state to `acknowledged` (F-1).
2. **Web:** let the Welcome-page language toggle wrap or shrink at ≤ 320 px (F-2).
3. **Seed (backend):** add one synthetic unaffiliated family-role account (e.g. `invitee@demo.fg`) so the invite E2E can use a stranger. The suite will pick it up via `FG_E2E_INVITEE_EMAIL` / `FG_E2E_INVITEE_PASSWORD`.
4. **Contract (lead):** settle the 403-vs-404 wording for a grantless member (SR-13 vs the v0.2 header).

## 7. Files
- `tests/e2e/playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/helpers.ts`, `tests/e2e/.gitignore`
- `tests/e2e/api/01-auth-csrf.spec.ts` … `07-help-requests.spec.ts`
- `tests/e2e/ui/ac03-senior-checkin.spec.ts`, `ac04-family-authorised`, `ac05-scam-warning`, `ac06-guardian-pause`, `ac07-call-contact`, `ac08-help-ack`, `ac09-revoke`, `ac11-emergency`
- `tests/e2e/a11y/axe.spec.ts`, `tests/e2e/a11y/keyboard-and-reflow.spec.ts`
- `tests/e2e/safety/forbidden-phrases.spec.ts`
- Artifacts (git-ignored): `tests/e2e/test-results/results.json`, `tests/e2e/test-results/axe-summary.json`, `tests/e2e/playwright-report/`
