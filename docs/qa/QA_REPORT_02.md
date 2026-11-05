# FGAI-2026-001 — Independent QA Report #02 (retest after web UX/a11y merge + API contract v0.3)

| Field | Value |
|---|---|
| QA agent | Independent QA Agent. No app code edited; changes only in `tests/e2e/**` and `docs/qa/**` |
| Date | 2026-11-05 (about 21:05 +07) |
| Under test | main after merging (1) web: Codex UX review P0 + a11y fixes + Thai/English microcopy pass (`docs/design/CODEX_UX_DESIGN_01.md`), and (2) API contract v0.3: undo check-in, retention purge, audit hash chain, register, the F-1 ack fix, and spare invitee `lek@demo.fg` |
| Command | `FG_E2E_INVITEE_EMAIL=lek@demo.fg FG_E2E_INVITEE_PASSWORD=Demo-Family-2026 FG_E2E_API_CMD='pnpm --filter @fg/api start' pnpm test:e2e` |
| Servers | Web on :3100 was already running (the lead's process) and was **reused**. The API was not listening on :4100, so Playwright started it in non-watch mode and stopped it at the end. The lead's web process was left running |
| Previous report | `docs/qa/QA_REPORT_01.md` (225/227; F-1 and F-2 open) |

## 1. Result (actual)

**236 tests: 236 passed, 0 failed, 0 skipped, 0 flaky.** Duration 2.0 min. Exit 0.

Source: `tests/e2e/test-results/results.json` → `{"expected":236,"skipped":0,"unexpected":0,"flaky":0}`.

| Area | Tests | Pass | Fail |
|---|---|---|---|
| API contract and authz (`api/`, 8 files, incl. new `08-v03-undo-register.spec.ts`) | 160 | 160 | 0 |
| UI journeys, one per AC (`ui/`, 8 files) | 20 | 20 | 0 |
| Accessibility: axe, keyboard, 320 px (`a11y/`) | 42 | 42 | 0 |
| Forbidden-phrase sweep, th + en (`safety/`) | 14 | 14 | 0 |

**Baseline before my changes.** I re-ran the unchanged QA-01 suite on the merged code with the invitee env vars and got **220 passed, 6 failed, 1 did not run**. That matches the lead's run. The "did not run" test was the second test in the serial `ac08` file, which was skipped after the first one failed.

## 2. Triage of the 6 failures: behaviour vs. wording

For each failure I read the failing page's accessibility snapshot (`error-context.md`) and checked that the acceptance criterion still holds before I changed any selector. **All 6 were wording or structure changes. None was a behaviour regression.** Selectors now accept both the old and the new copy, and no assertion was removed or weakened.

| # | Test | What changed | Does the AC still hold? (evidence from the snapshot) | Action |
|---|---|---|---|---|
| 1 | AC-3 trend shows the entry, neutral gaps | Trend heading is now "ประวัติการเช็กอินของฉัน"; the gap label is now "ยังไม่ได้บันทึก" | **Yes.** The list shows only the senior's own entries, e.g. "จันทร์ 2 พ.ย. ยังไม่ได้บันทึก". The gap label is neutral and nothing reads as a decline | Heading regex widened. **Added** an assertion that a neutral gap label (ไม่มีข้อมูล / ยังไม่ได้บันทึก / No data / Not recorded) is present, which strengthens S-03 |
| 2 | AC-3 "only me" | The old checkbox "เก็บไว้ดูคนเดียว" was replaced by an audience radio group "ใครดูเช็กอินนี้ได้" with the options "เฉพาะฉัน" and "แชร์กับคนที่ได้รับสิทธิ์ดูการเช็กอิน" | **Yes.** Only-me still saves as private and confirms with "บันทึกไว้เฉพาะฉัน". See finding O-1 about the default | Selector now uses the radio. **Added** a new test: exactly one audience is preselected, the share option names Nok before saving, and a check-in saved with "share" in the UI then reaches Nok through the API (`onlyMe:false`, visible in `/seniors/:id/checkins`) |
| 3 | AC-5 scam result headings | "ทำไมถึงคิดแบบนี้" → "จุดที่ควรระวัง"; "สิ่งที่เรายังไม่แน่ใจ" → "สิ่งที่แอปยังยืนยันไม่ได้" | **Yes.** High-risk label "เสี่ยงสูง — หยุดก่อน". Five quoted reasons, each now also warned "จากข้อความที่ได้รับ — อย่ากดหรือโทรตาม". The uncertainty section, "สิ่งที่ควรทำต่อ" steps, `tel:1441` and "ask family" are all present. No "ปลอดภัย" | Heading regexes widened. The steps heading is still required |
| 4 | AC-7 call log | "เริ่มโทรจากแอป" → "ขอเปิดแอปโทรศัพท์เพื่อโทรหา {name} เวลา {time}" | **Yes, and more honest (SR-16).** It says the app *asked the phone app* to call, next to "แอปไม่ทราบว่าสายติดหรือไม่". There is no connection claim. The API still logs `call_started_from_app` and the link is still `tel:` | Regex widened. The "never connected" assertion is unchanged |
| 5 | AC-8 "no one acknowledged yet" | "ยังไม่มีใครรับทราบ" → "ยังไม่มีใครกดรับทราบ — ถ้าเร่งด่วนโทร 1669"; ack → "{name} กดรับทราบแล้ว" | **Yes.** Delivery states are now labelled honestly as simulated ("จำลองการส่งถึง นก (Nok) เท่านั้น … ไม่ได้ส่งจริง เป็นระบบทดสอบ", SR-16). The intended recipients are shown before sending. The 1669 fallback is kept. "กดรับทราบแล้ว" does not imply that help is coming | Regex widened, including the "จำลองการส่งถึง" state. The second test (no recipients; copy now "ยังไม่ได้ส่งถึงใคร กรุณาเลือกผู้รับคำขอ") still asserts that no "sent" state appears and that `tel:1669` is shown |
| 6 | AC-11 unverified badge | "รอการยืนยันข้อมูล" → "ข้อมูลเบอร์นี้ยังรอผู้ดูแลระบบตรวจสอบ" | **Yes.** The badge is shown on every entry (1669, 191, 1441, 1300). The page is reachable logged out. "แอปไม่ได้แจ้งหน่วยงานให้อัตโนมัติ" is still there. No case number or acknowledgement | Regex widened |

## 3. Retests and new v0.3 coverage

| Item | Result | Evidence |
|---|---|---|
| **F-1 retest** (delivery state after ack) | **Fixed: PASS** | `07-help-requests` › after Nok's `POST /alerts/:id/ack`, Somsri's `GET /me/alerts` shows Nok's delivery `state: 'acknowledged'` within the 10 s poll. The UI journey AC-8 passes too |
| **F-2 retest** (320 px Welcome page) | **Fixed: PASS** | `320px anon /`: `scrollWidth <= clientWidth`. All 16 screens checked at 320 px pass |
| Invite flow with spare invitee `lek@demo.fg` | PASS (9/9) | Anan is no longer touched. Accept → `pending_confirmation`, 0 grants, no data. The token is single-use. Confirm needs the step-up password. Lek is then a member with `activeGrants: []`, and afterAll removes Lek again |
| Undo within 10 min | PASS | `DELETE /me/checkins/:id` → 204. The row is gone from the senior's list, from Nok's shared list and from Nok's dashboard. A repeat delete gives 404 |
| Undo after 10 min | PASS (without faking time) | The API has no clock override, so the test uses a **seeded, days-old** check-in: 409 with `error.code = 'undo_window_passed'`, and the row remains |
| Undo by another role / without CSRF / unknown id | PASS | Nok → 403/404 and the row survives. No `x-fg-csrf` → refused and the row survives. Random UUID → 404 |
| Register: new vs existing email | PASS | Both return **202** with a byte-identical body (`status:'accepted'`). Neither call signs in (`/auth/me` stays 401 in both contexts). Nok's existing account still signs in with her original password |
| Register: weak password / no CSRF / `role:'admin'` | PASS | Server log shows the actual statuses: 400 `weak_password`, 403 (CSRF), 400 (admin role refused) |

Not covered: the retention purge and the audit hash chain have no HTTP surface in the contract, so E2E cannot reach them; the API unit tests cover them per the lead. There is no Undo control in the web UI yet (`checkin/page.tsx` still has a TODO), so undo is tested at the API level only.

## 4. Accessibility (axe-core)
24 screen × role combinations, tags wcag2a/2aa/21a/21aa/22aa: **0 violations of any impact.** The keyboard-only check-in passes against the new audience radio group, and the skip link is the first focusable element. Raw data: `tests/e2e/test-results/axe-summary.json`.

## 5. Forbidden phrases
14 crawls (6 roles × th/en, plus the senior scam-result and help-sent screens in both locales) found **0 occurrences** of the 16 `FORBIDDEN_PHRASES` in the new microcopy.

## 6. Open observations (not defects in the suite's pass/fail sense)

| ID | Severity | Observation | Maps to | Recommendation |
|---|---|---|---|---|
| O-1 | **Low / needs a PO decision** | The check-in audience now **defaults to "เฉพาะฉัน" (only me)** (`apps/web/lib/checkin.ts: INITIAL_AUDIENCE = 'only_me'`). This follows the Codex UX review ("Default to private"). Story **S-02** still says "default = the standing grant". With the minimum 3-tap path, a check-in therefore reaches no one unless the senior picks "share", so a family member with a `checkins` grant (AC-4) sees nothing from default check-ins. This is privacy-protective, but it conflicts with the written AC | S-02, AC-3/AC-4 | The Product Owner either updates S-02 to "default = private, share is one extra tap" or restores the standing-grant default. QA accepts either, but the spec and the build must agree before UAT |
| O-2 | Info | There is no Undo button in the UI yet. The API supports it (v0.3) | UX §2 | Web backlog |

**No open Critical, High or Medium defects.** F-1 and F-2 from QA-01 are closed.

## 7. Suite changes in this round (tests/e2e only)
- Selectors widened in `ui/ac03-senior-checkin.spec.ts`, `ui/ac05-scam-warning.spec.ts`, `ui/ac07-call-contact.spec.ts`, `ui/ac08-help-ack.spec.ts`, `ui/ac11-emergency.spec.ts`. Old and new copy are both accepted.
- New: the neutral-gap assertion and the audience-choice test (`ui/ac03`); `api/08-v03-undo-register.spec.ts` (8 tests).
- The invite spec takes the invitee from `FG_E2E_INVITEE_EMAIL` / `FG_E2E_INVITEE_PASSWORD`. When they are not set, it falls back to the re-invite-Anan path.
- Rate limits: register is limited to 5 per hour per IP. The new register tests make exactly 5 counted calls, so running them twice against the **same** API process within an hour returns 429. A Playwright-started API is fresh on every run.
