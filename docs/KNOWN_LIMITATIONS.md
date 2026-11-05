# FGAI-2026-001 — Known limitations

Version 0.1 · 2026-11-05 · maintained by DevOps / Release. Required before UAT (AC-15).

This list is deliberately blunt. FamilyGuardian AI is an **MVP in development** that runs
locally on **synthetic data only**. Nothing here has passed the DESIGN, ARCH, QA, UAT or
RELEASE gates (see `config/gates.yaml` and `docs/decisions/DECISIONS_LOG.md`). Items move
off this list only with evidence (a test, a review, or a signed gate), never by assertion.

## 1. Product

- **Feature-incomplete.** At the time of writing the backend, web app and AI package are still
  being built in parallel (`docs/decisions/agent_status.json`). Screens such as the family
  dashboard, alerts, privacy matrix, admin and billing are not finished. Treat any feature
  list as "planned" unless a test report says otherwise.
- **No bank access of any kind.** The app does not read, intercept, pause or block real
  transactions or OTPs. Guardian Pause is a self-reflection checklist, not a payment control.
- **No agency reporting.** Nothing is sent to police, hospitals, banks or the AOC (1441). There
  are no case numbers. Case summaries are "prepared by the user, not submitted to any agency".
- **Calls are hand-offs.** "Call" opens the phone dialler (`tel:`). The app cannot know whether
  a call connected, and on a desktop browser nothing may happen at all.
- **Notifications are simulated.** Push and email adapters only write delivery states to the
  database. No one's phone buzzes. SR-16 (label simulated states as "จำลอง / simulated" in
  senior-facing text) is not yet verified in the UI.
- **Payments are sandbox only.** Plans, checkout and webhooks are simulated. No real money
  moves; live providers are disabled in code (`packages/payments/src/live-guard.ts`).
  Pricing (Free / ฿199 / ฿349 / B2B) is a hypothesis (A10).
- **Web PWA only.** No native app (Expo is P2), so no real push, no app-store billing and no
  native dialler integration.
- **No diagnosis or emotion inference.** FeelSense check-ins are self-reported. Trends show
  only what the senior entered; gaps are "no data", never "decline".
- Not in the MVP: medication/appointment reminders and care tasks (P1), data export and
  deletion (P1), screenshot OCR, caller ID, health-data integrations, location tracking.

## 2. Safety

- **No "safe" verdict, ever.** ScamShield's lowest result is "no clear risk signals found —
  still verify". It can miss scams (false negatives) and flag genuine messages (false
  positives). It is a prompt to verify, not a decision.
- **Help directory not verified by a human.** 1669, 191 and 1441 are seeded with
  `verification = 'needs_human_verification'` (blocker B4). **No bank fraud-line numbers** are
  shown until a human records the bank's own source URL and date.
- **Help requests depend on the senior's circle.** If no one holds a `help_requests` grant,
  nobody is notified; the UI must say so and point to 1669 (SR-12). Follow-up/escalation
  timing is configurable and not validated with real users.
- **Coercive control is only partly mitigated.** The person who set up the phone may be the
  risk (SR-10). The 24 h cooling-off for sensitive grants is deferred and needs owner risk
  acceptance; the privacy-checkup flow is not built.
- Thai copy has not been reviewed by a native-speaking UX reviewer or by older adults
  (DESIGN gate evidence outstanding).

## 3. Security

Source: `docs/safety/SECURITY_REVIEW_01_design.md` (agent review of the **design**, 36
findings: 0 critical, 9 high). Per the decisions log, SR-01…SR-13 were applied **to the API
contract v0.2**. Whether the implementation honours them is **not yet verified** by an
independent code review or by the authz-matrix E2E tests.

Open (not fixed or not verified), most important first:

| Item | Severity | Status |
|---|---|---|
| SR-10 coercive setup / isolation | High | Partial: copy change and login-free emergency page planned; 24 h cool-off deferred (needs owner risk acceptance) |
| SR-01…SR-09, SR-11…SR-13 | High/Medium | Fixed in contract v0.2; **implementation not independently verified** |
| SR-11 session hardening | High | Partial in code: Argon2id + DB sessions; cookie is named `fg_session`, not `__Host-` prefixed; step-up / sessions list to be verified |
| SR-14 shared-device caching | Medium | Partial: `Cache-Control: no-store` on `/api/v1` (next.config); logout sends `Clear-Site-Data: "cache", "storage"` (in code, untested); back-button QA test not run |
| SR-15 lockout / login-free emergency screen | Medium | Rate limits present on login, invites, accept and senior writes; progressive delay and login-free emergency screen not verified |
| SR-16 simulated-channel honesty labels | Medium | Open — **blocks UAT** |
| SR-17 directory tampering (two-person rule, admin MFA) | Medium | Open |
| SR-18 scam evidence rendering | Medium | Partial: `format-detection: telephone=no` set in the web layout; defanging/ReDoS review not verified |
| SR-19 AI explainer text safety | Medium | Open — **blocks enabling any AI provider** (AI is off by default) |
| SR-20 runtime forbidden-phrase check (Thai normalisation) | Medium | Open / not verified |
| SR-21 audit integrity | Medium | Partial: DB trigger rejects UPDATE/DELETE on `audit_events`; no separate DB roles, no hash chain, TRUNCATE still possible |
| SR-22 access log completeness | Low | Open |
| SR-23 Guardian Pause amount bucketing | Medium | Fixed in contract v0.2 (amount buckets); implementation not verified |
| SR-24 registration and password reset | Medium | Not designed / not built |
| SR-25 CSRF conditions | Low | Partial: `x-fg-csrf` header enforced on non-safe methods; Origin/Sec-Fetch-Site check and API port binding not verified |
| SR-26 notification payload templates | Low | Open |
| SR-27 display-name spoofing | Low | Open |
| SR-28 webhook replay (P1 billing) | Low | Not verified |
| SR-29 `org_admin` default-deny, admin MFA | Low | Open — no MFA anywhere |
| SR-30 XSS / CSP | Low | Partial: CSP with `'unsafe-inline'` (no nonces), `frame-ancestors 'none'`, `nosniff` |
| SR-31…SR-34 PDPA | Medium | Open — **block any real-user pilot** (see §4) |
| SR-35 doc consistency | Info | Partial (contract v0.2) |
| SR-36 canned-only family replies | Low | Open |

Other security gaps:
- **No named human security reviewer** has been appointed (blocker B1); the ARCH and QA gates
  need one.
- First-party auth only; **no MFA, no passkeys**, no managed IdP (ADR-004, P1).
- Secret scanning (gitleaks), dependency audit and SAST (semgrep) are **configured** in
  `.github/workflows/ci.yml` but have **never run in CI**: there is no GitHub remote. Gitleaks
  was run locally (0 findings after a test-path-scoped allowlist for one synthetic fixture
  password; see `docs/architecture/RELEASE_READINESS.md` Q6). The container healthcheck probes
  127.0.0.1, so it reports healthy even while the API is unreachable from outside (R5).
- Third-party GitHub Actions are pinned to major tags, not commit SHAs.
- Docker images run as the non-root `node` user but are not minimal (≈ 750–815 MB, full
  workspace with devDependencies, TypeScript run through `tsx`), are not scanned, and are not
  signed.

## 4. Data protection (PDPA)

Not legal advice; a qualified Thai DPO or lawyer must review (blocker B5).

- Well-being check-ins are probably **sensitive data** under PDPA s.26. Account-level explicit
  consent, lawful basis per category, privacy-notice versioning and a RoPA do not exist yet
  (SR-31).
- Third-party data (trusted contacts, content of scam messages), minors and reduced-capacity
  questions are not handled (SR-32). No age attestation.
- Data-subject rights: export and deletion are P1 and not built; rectification, objection,
  restriction and portability are not designed; deletion does not cascade to alerts,
  notifications, logs or backups (SR-33).
- Retention periods in `docs/architecture/03_ARCHITECTURE.md` §5 are **proposed**; purge jobs
  are not verified.
- No cross-border transfer assessment, processor agreements or breach-notification runbook
  (SR-34). This blocks enabling the Anthropic API and any hosted staging.
- **Rule:** synthetic data only. No real names, phone numbers, health or bank data may be
  entered anywhere, including demos.

## 5. Accessibility

- No axe-core results yet; the QA gate requires 0 serious/critical. An a11y E2E folder exists
  (`tests/e2e/a11y/`) but holds no specs at the time of writing.
- No manual keyboard, VoiceOver/TalkBack or 200 % zoom pass has been recorded.
- Large-tap tiles, plain Thai and ≤ 3-tap check-in are **design intents** from the UX spec,
  not tested with older adults.

## 6. AI evaluation limits

- ScamShield runs a **deterministic rules engine**; the optional LLM explainer is **off**
  (B2 = rules only) and must stay off until SR-19 and SR-34 are closed and the owner approves.
- The eval set (`packages/ai/evals/scam_cases.json`) is small, synthetic and authored by the
  same team that wrote the rules, so it measures consistency, not real-world accuracy. No
  precision/recall on real Thai scam traffic exists.
- New scam scripts, images/screenshots (no OCR), voice calls and LINE-specific formats are not
  covered. URLs are analysed as strings only; nothing is fetched (no reputation lookup).
- Thai text normalisation (zero-width characters, mixed scripts, transliteration) is a known
  weak point for keyword rules (SR-20).

## 7. Infrastructure and operations

- **Local only.** No staging or production environment, hosting region or domain (B6). The
  RELEASE gate is closed and there is no deploy pipeline — deliberately.
- No GitHub remote; CI has never executed. The workflow is unverified until it runs on a real
  runner.
- The Docker `full` profile images **build** (see RELEASE_READINESS). The API container starts
  and reports healthy, but `services/api/src/server.ts` binds `localhost` only, so the web
  container and the host cannot reach it yet. The `full` profile is therefore not usable end
  to end until the API honours `HOST` (backend change requested).
- Backups are manual `pg_dump` to a local file: no schedule, no encryption, no off-host copy,
  no PITR. The restore rehearsal so far ran on an **unseeded** database (schema round trip
  only); see `docs/architecture/RUNBOOK_LOCAL.md` §5.4.
- Single Postgres instance, pg-boss queue in the same DB; no monitoring, alerting or log
  shipping. Logs are JSON to stdout.
- The local DB password and session secret are documented placeholders
  (`fg_local_only`, `change-me-local-only-…`) and must never be reused anywhere else.
