# FGAI-2026-001 — Backlog, QA/UAT Strategy & Human Approval Checklist (v0.1)

Status: **DRAFT.** Covers deliverables §8 (backlog with agent ownership), §9 (QA and UAT) and §10 (approval checklist).

## 8. Prioritised backlog with agent ownership

Agent roles follow the directive §10. They map to the TELCO A-series role definitions as **templates only**: separate FGAI subagent files will be created in this repo after SCOPE approval. QA and Security agents are **read-only** and never review their own work.

| Directive agent | Template role | Owns |
|---|---|---|
| Product & Research | A02 BA + A04 UX research | PRD, stories, personas, research docs |
| UX & Accessibility | A04/A05 | UX spec, screens, a11y checklist |
| Frontend | A08 | apps/web, packages/ui |
| Backend & Database | A09 | services/api, schema, policy engine, queue |
| AI & Fraud Intelligence | A10 | packages/ai, rules, evals |
| Healthcare Safety | (new, FG-HS) | copy review for medical claims, check-in safety rules |
| Payment & Business | A01 presales + A14 | packages/payments, BMC, pricing, unit economics |
| Independent QA | A11 (read-only) | test plans, reviews, gate evidence |
| Independent Security/Privacy | A12 (read-only) | threat-model review, authz matrix review, SAST results |
| Release & Docs | A13 + A15 | README, runbooks, release checklist |

### Backlog (dependency-aware; `→` = depends on)

| ID | Item | Pri | Owner | Depends on |
|---|---|---|---|---|
| G-1 | SCOPE gate sign-off (this pack) | — | Human PO | — |
| D-1 | Clickable screen designs for screens 1, 3, 5, 6, 8, 9, 10, 11, 15 | P0 | UX | G-1 |
| G-2 | DESIGN gate | — | Human UX+PO | D-1 |
| R-1 | Independent threat-model review | P0 | Security (RO) | G-1 |
| G-3 | ARCH gate | — | Human TL+Sec | G-2, R-1 |
| B-1 | Monorepo, Docker Compose, CI, lint, secret scan | P0 | Backend/Release | G-3 |
| B-2 | Schema + migrations + synthetic seed | P0 | Backend | B-1 |
| B-3 | Auth + sessions + rate limit | P0 | Backend | B-2 |
| B-4 | Policy engine + grant model + authz test matrix | P0 | Backend | B-3 |
| B-5 | Audit events | P0 | Backend | B-2 |
| F-1 | UI kit + i18n th/en + senior home | P0 | Frontend | B-1, G-2 |
| F-2 | Check-in + trend | P0 | Frontend+Backend | B-4, F-1 |
| F-3 | Trusted contacts, call-logging, emergency directory | P0 | Frontend+Backend | B-4 |
| AI-1 | ScamShield rules engine + 40-case synthetic eval set (TH/EN) | P0 | AI | B-1 |
| F-4 | ScamShield UI | P0 | Frontend | AI-1, F-1 |
| F-5 | Guardian Pause | P0 | Frontend+AI | F-1 |
| B-6 | Invitations + Family Circle + grants UI | P0 | Backend+Frontend | B-4 |
| B-7 | Notification engine (pg-boss) + simulated adapters + ack + follow-up | P0 | Backend | B-4, B-5 |
| F-6 | Family dashboard + alert detail + notification centre | P0 | Frontend | B-6, B-7 |
| HS-1 | Healthcare-safety copy review (forbidden-phrase test) | P0 | Healthcare Safety | F-2, F-4 |
| Q-1 | QA + security review of INC-0…3; E2E for AC 2–9, 11 | P0 | QA (RO) + Sec (RO) | F-6 |
| G-4 | QA gate (P0 MVP) | — | Human QA+Sec | Q-1 |
| P1-1 | Reminders + care tasks | P1 | Backend+Frontend | G-4 |
| P1-2 | Sandbox billing + entitlements | P1 | Payments | G-4 |
| P1-3 | Admin dashboard + directory editor | P1 | Backend+Frontend | G-4 |
| P1-4 | Export / deletion / purge jobs | P1 | Backend | G-4 |
| DOC-1…n | §12 research and business deliverables (run in parallel, independent of code) | — | Product & Payment/Business | G-1 |
| G-5 | UAT (senior + family testers, synthetic data) | — | Humans | G-4 |
| G-6 | RELEASE (staging only unless authorised) | — | Human PM+DevOps | G-5 |

Parallel lanes after G-3: {B-1…B-5} · {AI-1} · {DOC-*}. Frontend starts once B-1 and G-2 are done.

## 9. QA and UAT strategy

**Test layers**
- *Unit (Vitest)*: policy engine (every role × category × grant state: active, expired, revoked, none), ScamShield rules, Guardian Pause scoring, notification state machine, label vocabulary.
- *Integration*: API against a real Postgres in Docker (testcontainers or compose profile), with webhook signature and idempotency tests (P1).
- *E2E (Playwright)*: one journey per AC: senior check-in; family sees only granted data; revoke → 403; scam warning shown; Guardian Pause warning; call-tile has the `tel:` href and logs correctly; help request → ack visible to senior; emergency screen has no fabricated acknowledgement.
- *Accessibility*: axe-core in E2E (0 serious/critical), manual keyboard and VoiceOver pass on the senior screens, 200% zoom check.
- *Safety*: forbidden-phrase test over all i18n strings, and the ScamShield eval set (report recall on scam cases and false-positive rate on benign cases. **These are measured numbers, never claimed in advance**).
- *Security*: gitleaks, `pnpm audit`, semgrep, header check, rate-limit test.

**Evidence rule:** every increment report pastes the actual test command output (pass/fail counts). A gate request lists open findings by severity.

**UAT plan (synthetic data):** 3–5 older adults plus 3–5 family members run scripted tasks (check-in, check a scam SMS, Guardian Pause, call contact, change sharing). We measure unaided completion, time, errors and perceived autonomy (5-point). Facilitator script and consent form are in `docs/research/` (DOC track). Acceptance: each P0 task completed unaided by ≥ 80% of senior testers. This threshold is a proposal for the PO to approve.

## 10. Human approval checklist

| Gate | Signer(s) | Evidence required | Status |
|---|---|---|---|
| **SCOPE** | Product Owner | This pack (01–05) reviewed; assumptions A1–A10 accepted or amended; blockers B1–B3 answered | ☐ Pending |
| **DESIGN** | UX reviewer + PO | Clickable screens; Thai copy reviewed by a native speaker; a11y checklist | ☐ Not started |
| **ARCH** | Tech Lead + Security (not the author) | ADRs 001–008 accepted; threat model independently reviewed; API contract draft | ☐ Not started |
| **QA** | Independent QA + Security | Test reports, axe results, authz matrix, 0 critical/high | ☐ Not started |
| **UAT** | Human testers + PO | UAT results, known limitations accepted | ☐ Not started |
| **RELEASE** | PM + DevOps (explicit written authorisation) | Release note, backup/restore and rollback rehearsal, help-directory verification evidence | ☐ Not started |

Also needs explicit human approval at any time: enabling any real AI/notification/payment provider; any purchase; any outbound message to real people or partners; using real personal data.
