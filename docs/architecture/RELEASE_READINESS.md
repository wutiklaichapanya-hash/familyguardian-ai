# FGAI-2026-001 — Release readiness checklist

Version 0.1 · 2026-11-05 · prepared by DevOps / Release (agent). **Not a sign-off.**
`self_approval: forbidden` (`config/gates.yaml`): every gate is signed by the human roles
listed, never by the agent that produced the evidence.

## How to read this

| Mark | Meaning |
|---|---|
| ☑ | Verified from files in this repo or a command actually run, with the evidence linked |
| ◐ | Partly there: some evidence exists, but the gate criterion is not fully met |
| ☐ | Not started, not verifiable from the repo, or depends on a human decision |

Only what could be checked on 2026-11-05 is marked ◐ or ☑. Everything else is ☐ by default,
including items that other agents may be finishing right now. Re-run the checks before each
gate review and update the marks with evidence.

Overall: **not releasable.** The RELEASE gate depends on UAT → QA → ARCH → DESIGN, and only
SCOPE is signed.

## 1. Gates (`config/gates.yaml`)

### SCOPE — product_owner

| # | Evidence required | Status | Evidence |
|---|---|---|---|
| S1 | Planning pack 01–05 reviewed | ☑ | [`docs/decisions/DECISIONS_LOG.md`](../decisions/DECISIONS_LOG.md) row 1 (SCOPE approved 2026-11-05) |
| S2 | Assumptions A1–A10 accepted | ☑ | Same row: "A1–A10 accepted" |
| S3 | Blockers B1–B3 answered | ☑ | Same row: B1/B2/B3 defaults recorded. B4–B6 remain open (they block UAT/pilot/RELEASE prep) |

### DESIGN — ux_reviewer, product_owner (not signed)

| # | Evidence required | Status | Evidence |
|---|---|---|---|
| D1 | Clickable screens | ◐ | `next build` in the Docker web image (2026-11-05 20:23) compiles 18 routes: `/login`, `/home`, `/checkin`, `/contacts`, `/scam-check`, `/guardian-pause`, `/help`, `/emergency`, `/privacy`, `/invite/accept`, `/family`, `/alerts/[id]`, `/notifications`, `/admin`, `/billing` and others. Compiling is not the same as clickable against a live API; no UX review |
| D2 | Thai copy native review | ☐ | No review record |
| D3 | a11y checklist | ☐ | No checklist document; UX intents only in [`docs/product/04_UX_SPEC.md`](../product/04_UX_SPEC.md) |
| D4 | Gate signed | ☐ | DECISIONS_LOG row 2: DESIGN "not signed yet" |

### ARCH — tech_lead, security (not signed)

| # | Evidence required | Status | Evidence |
|---|---|---|---|
| A1 | ADR 001–008 | ◐ | Summaries in [`03_ARCHITECTURE.md`](03_ARCHITECTURE.md) §2; no individual ADR files; stack superseded by DECISIONS_LOG row 3 (Next 16) |
| A2 | Independent threat-model review | ◐ | Agent review [`docs/safety/SECURITY_REVIEW_01_design.md`](../safety/SECURITY_REVIEW_01_design.md) (36 findings, 0 critical, 9 high); SR-01…13 applied to contract v0.2 (DECISIONS_LOG row 5). **Named human security co-signer still missing (B1)** |
| A3 | API contract draft | ☑ | [`packages/shared/src/api.ts`](../../packages/shared/src/api.ts), `domain.ts`, `labels.ts` (contract v0.2) |
| A4 | Gate signed | ☐ | Not signed |

### QA — qa, security

| # | Evidence required | Status | Evidence |
|---|---|---|---|
| Q1 | Test report with real counts | ◐ | `pnpm --filter @fg/payments test` → **71 passed / 71** (run 2026-11-05 20:19 local). `pnpm --filter @fg/ai test` → **113 passed / 113**, 8 files (run 2026-11-05 20:22 local; an earlier run at 20:19 failed while that package's tests were still being written). API, web and E2E counts not available. No consolidated report |
| Q2 | axe 0 serious/critical | ☐ | `tests/e2e/a11y/` is empty |
| Q3 | Authz matrix | ◐ | Spec written: `tests/e2e/api/02-authz-matrix.spec.ts`, `03-dashboard-grants.spec.ts`; **not yet run** against a seeded API |
| Q4 | 0 critical/high open | ☐ | SR-10 (High) partial; SR-01…09/11…13 fixed in contract but not verified in code ([KNOWN_LIMITATIONS §3](../KNOWN_LIMITATIONS.md#3-security)) |
| Q5 | CI pipeline (typecheck, unit, e2e, gitleaks, audit, semgrep) | ◐ | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) written; **never executed** (no GitHub remote) |
| Q6 | Secret scan clean | ☑ | gitleaks v8.28.0 (Docker) with [`.gitleaks.toml`](../../.gitleaks.toml), 2026-11-05 20:24: `git` mode 2 commits → no leaks; `dir` mode working tree → no leaks (after adding a test-path-scoped allowlist for the synthetic fixture password in `services/api/test/helpers.ts`, which the default `generic-api-key` rule flagged). Positive controls: planted fake GitHub token + generic key → 2 leaks, exit 1; the fixture literal outside a test directory → 1 leak |
| Q7 | Dependency audit (high+) | ☐ | `pnpm audit --audit-level high` not run yet |
| Q8 | SAST (semgrep p/typescript, p/owasp-top-ten) | ☐ | Not run yet |

### UAT — product_owner, uat_testers

| # | Evidence required | Status | Evidence |
|---|---|---|---|
| U1 | UAT results | ☐ | None. SR-16 (simulated-channel labels) blocks UAT |
| U2 | Known limitations accepted | ◐ | [`docs/KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md) exists (v0.1); not yet accepted by the PO |

### RELEASE — pm, devops

| # | Evidence required | Status | Evidence |
|---|---|---|---|
| R1 | Release note | ☐ | None |
| R2 | Rollback + restore rehearsal | ◐ | Restore rehearsal 2026-11-05: `pg_dump -Fc` → restore into scratch DB `familyguardian_restore_test`, exit 0, schema objects and migration journal identical, scratch DB dropped ([`RUNBOOK_LOCAL.md` §5.4](RUNBOOK_LOCAL.md#54-rehearsal-evidence-release-gate-rollback--restore-rehearsal)). **Ran on an unseeded DB** (data round trip not proven). No application rollback procedure (no deploy target exists). Agent-performed, a human must repeat |
| R3 | Help-directory verification | ☐ | 1669/191/1441 seeded as `needs_human_verification` (`services/api/src/db/schema.ts`); B4 open; no bank numbers |
| R4 | Container images build | ☑ | `docker compose -f infrastructure/docker-compose.yml --profile full build` → exit 0, `familyguardian-api` and `familyguardian-web` built, running as uid 1000 `node` (2026-11-05) |
| R5 | Containers run healthy end to end | ☐ | Smoke test 2026-11-05 20:24 against a scratch DB (`familyguardian_container_test`, migrated in-container, then dropped): API container reports **healthy** and `/api/health` → `{"status":"ok","db":"ok"}` from inside the container. **But** `services/api/src/server.ts` listens on `host: 'localhost'`, so the API is unreachable from the web container or the host port mapping (connection refused on the container address). Needs `host: process.env.HOST ?? 'localhost'` (backend-owned). Web container not run |
| R6 | Deploy automation | — | **Intentionally absent.** Deploys require this gate and are not automated (comment in `ci.yml`) |

### Always requires human approval (`always_requires_human_approval`)

| Item | Status | Evidence |
|---|---|---|
| Enable real AI / notification / payment provider | ☑ not enabled | `.env.example`: `AI_EXPLAINER_ENABLED=false`, `PAYMENTS_MODE=sandbox`; `packages/payments/src/live-guard.ts` |
| Purchases | ☑ none | Sandbox only |
| Outbound communication to real people or partners | ◐ | Adapters are simulated by design (ADR-008); not independently verified that no adapter sends |
| Use of real personal, health or financial data | ◐ | Rule in the agent brief; `users.is_synthetic` column exists; no automated check |

## 2. Directive §11 completion criteria (AC-1 … AC-15)

The directive itself is **not stored in this repo** (see `docs/product/PRD.md` §4 note).
The descriptions below are reconstructed from how `docs/product/01_DISCOVERY_AND_SCOPE.md`
cites each AC number; the PO must confirm them. AC-10 is never cited in the repo.

| AC | Meaning (as cited in 01_DISCOVERY_AND_SCOPE) | Status | Evidence |
|---|---|---|---|
| AC-1 | `docker compose up` + documented seed command start the app | ◐ | DB starts (`familyguardian-db-1` healthy); `full` profile images build (exit 0); API container starts healthy but binds localhost only (see R5); seed script now present (`services/api/src/db/seed.ts`), not run by this agent; never run end to end |
| AC-2 | Seeded roles (senior, family ×2 with/without grants, caregiver, admin); sign-in works | ☐ | Demo accounts defined in [`AGENT_BRIEF_COMMON.md`](../decisions/AGENT_BRIEF_COMMON.md); `services/api/src/db/seed.ts` appeared during this review but was not run or reviewed; main DB had 0 users at 20:17 |
| AC-3 | Senior daily check-in (≤ 3 taps, keyboard / screen reader) | ◐ | `/checkin` route builds; no test evidence |
| AC-4 | Family sees only granted categories; zero-grant member sees nothing | ◐ | E2E specs written (`tests/e2e/api/02-*`, `03-*`), not run |
| AC-5 | ScamShield result with category, evidence, uncertainty, never "safe" | ◐ | Rules engine in `packages/ai/src` with unit tests (113/113 pass, 2026-11-05); no eval report and no UI/E2E evidence yet |
| AC-6 | Guardian Pause warning, no bank interaction | ☐ | Not built / not tested |
| AC-7 | `tel:` call with honest "call started from app" log | ☐ | `/contacts` route builds; no test evidence |
| AC-8 | Help request → honest delivery states → acknowledgement | ☐ | Not tested |
| AC-9 | Revoke → next request 403, content unavailable | ☐ | Not tested |
| AC-10 | *Not cited in the repo — PO to confirm* | ☐ | — |
| AC-11 | Emergency numbers; no screen claims an agency was notified | ☐ | Not tested; directory entries `needs_human_verification` |
| AC-12 | Automated tests run with one command; real pass/fail counts per increment | ◐ | `pnpm test` / `pnpm test:e2e` defined in `package.json`; only packages have passing counts (payments 71/71, ai 113/113); API, web and E2E not yet; CI not executed |
| AC-13 | Security and accessibility findings in `docs/safety/` with status | ◐ | Security review present with severities and status; no accessibility findings yet |
| AC-14 | All data synthetic; seed file marked as such | ◐ | `users.is_synthetic` column in schema; test helpers insert `isSynthetic: true`; seed file not reviewed |
| AC-15 | `docs/KNOWN_LIMITATIONS.md` exists before UAT | ☑ | [`docs/KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md) v0.1 (acceptance by PO is tracked as U2) |

## 3. Re-verification commands

```bash
export NVM_DIR=~/.nvm; . "$NVM_DIR/nvm.sh" >/dev/null; export PATH=~/.local/bin:$PATH
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm audit --audit-level high
docker run --rm -v "$PWD:/repo:ro" ghcr.io/gitleaks/gitleaks:v8.28.0 git --config /repo/.gitleaks.toml --redact /repo
docker compose -f infrastructure/docker-compose.yml --profile full build
```
