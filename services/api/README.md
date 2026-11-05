# @fg/api — FamilyGuardian AI API (P0 + P1 sandbox billing)

Fastify 5 + Drizzle 0.45 (postgres-js) + pg-boss 12 + zod 4 + Argon2id. Implements contract **v0.2** in
`packages/shared/src/api.ts` under `/api/v1`. All demo data is **SYNTHETIC**.

## Run

```bash
pnpm db:up                 # Postgres 17 on localhost:5433 (from repo root)
pnpm db:migrate            # applies services/api/drizzle/*.sql
pnpm db:seed               # RESETS app tables and loads the SYNTHETIC demo (idempotent)
pnpm dev:api               # http://localhost:4100 (also starts the pg-boss worker in-process)
```

- Health: `GET /api/health` · OpenAPI UI: `/api/docs` (JSON at `/api/docs/json`)
- Demo accounts: see `docs/decisions/AGENT_BRIEF_COMMON.md` (somsri / nok / anan / pim / admin `@demo.fg`).
- Schema changes: edit `src/db/schema.ts`, then `pnpm --filter @fg/api db:generate`.

## Test

```bash
pnpm --filter @fg/api test        # Vitest, fastify.inject (no port)
pnpm --filter @fg/api typecheck
```

Tests use a **separate database `familyguardian_test`** on the same server; `test/globalSetup.ts` creates it if
missing and migrates it. Each test file re-seeds. Notification tests use a deterministic `ManualQueue`;
`test/worker.test.ts` runs the real pg-boss worker end to end.

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://fg:fg_local_only@localhost:5433/familyguardian` | |
| `API_PORT` / `HOST` | `4100` / `localhost` | compose sets `HOST=0.0.0.0` |
| `WEB_ORIGIN` | `http://localhost:3100` | only CORS origin (credentials); base for invite/checkout URLs |
| `SESSION_SECRET` | — | ≥ 32 chars (required in production) |
| `SESSION_TTL_DAYS` / `SESSION_IDLE_HOURS` | `30` / `12` | absolute / idle session lifetime |
| `LOGIN_RATE_LIMIT_MAX` | `5` | per IP+email per minute (429) |
| `LOGIN_DELAY_BASE_MS` | `250` | progressive delay after failed logins (no hard lockout, SR-15) |
| `RATE_LIMIT_GLOBAL_MAX` | `300` | per IP per minute |
| `HELP_RATE_LIMIT_MAX` / `SCAM_CHECK_RATE_LIMIT_MAX` / `INVITE_RATE_LIMIT_MAX` | `10` / `30` / `10` | per minute |
| `HELP_FOLLOWUP_MINUTES` | `10` | follow-up if a help alert is not acknowledged |
| `NOTIFY_MAX_RETRIES` | `3` | 1 attempt + N retries, then `failed` |
| `NOTIFY_RETRY_BASE_SECONDS` | `5` | backoff = base × 2^(attempt−1) |
| `NOTIFY_FORCE_FAIL` | `false` | simulated adapter fails every delivery (testing) |
| `INVITE_TTL_HOURS` / `INVITE_MAX_ATTEMPTS` | `72` / `5` | |
| `PAYMENTS_MODE` / `SANDBOX_WEBHOOK_SECRET` | `sandbox` / — | billing is sandbox-only |
| `LOG_LEVEL` | `info` | pino; body, cookies, auth/signature headers, phone, note, text, message, token, password redacted |

## Routes (`/api/v1`)

| Area | Routes |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/:id` |
| Check-ins | `POST /me/checkins`, `GET /me/checkins?days≤90`, `GET /seniors/:seniorId/checkins` |
| Contacts / logs | `GET/POST /me/contacts`, `DELETE /me/contacts/:id`, `POST /me/call-logs`, `GET /me/action-logs`, *extra:* `GET /seniors/:seniorId/contacts` |
| Directory | `GET /directory?country=TH` (**public**) |
| Help & alerts | `POST /me/help-requests`, `GET /me/alerts`, `GET /alerts`, `GET /alerts/:id`, `POST /alerts/:id/ack` |
| Notifications | `GET /notifications`, `POST /notifications/:id/seen` |
| ScamShield | `POST/GET /me/scam-checks`, `POST /me/scam-checks/:id/share`, `GET /seniors/:seniorId/scam-checks` |
| Guardian Pause | `POST/GET /me/guardian-pause`, `POST /me/guardian-pause/:id/share`, `GET /seniors/:seniorId/guardian-pause` |
| Circle | `POST/GET /me/invitations`, `DELETE /me/invitations/:id`, `POST /me/invitations/:id/confirm`, `POST /invitations/accept`, `GET /me/members`, `DELETE /me/members/:userId` |
| Consent | `GET/POST /me/grants`, `DELETE /me/grants/:id`, `GET /me/access-log` |
| Dashboard / admin | `GET /dashboard`, `GET /admin/overview` |
| Billing (P1 sandbox) | `GET /billing/plans`, `GET /me/subscription`, `POST /me/subscription/checkout`, `POST /me/subscription/cancel`, `POST /webhooks/payments/sandbox` |

### Notes for the web app (agreed with the lead)
- **`GET /directory` is public** (no session) so the logged-out emergency page can show 1669 / 191 / 1441 / 1300.
- **Invite URL** = `${WEB_ORIGIN}/invite/accept#token=<token>`. The token sits in the URL fragment (never sent to
  servers or logs); the page POSTs it in the body to `/invitations/accept`. Token = `<inviteId>.<128-bit secret>`.
- **Wrong or missing step-up password → `401` with `error.code = 'step_up_failed'`.** The session stays valid. A
  successful step-up rotates the session cookie. Step-up applies to member confirm, member removal and grants for
  `checkins` / `scam_checks` / `transfer_pauses`.
- Every mutation needs `x-fg-csrf: 1` (login included; the HMAC webhook is exempt). Responses are `Cache-Control: no-store`.
- Errors: `{ error: { code, message } }`. Data you may not see → **404** (also after a revoke or expiry); own-scope role violations → 403.

## Policy summary (`src/policy.ts`, one module for every read/write)

`authorize(actor, action, seniorId, category)` with actions `read | notify | write | manage_grants | admin_ops`.

- **Senior** = the user who owns the family (`families.senior_id`). Only they write their data, invite, confirm,
  remove members, and create or revoke grants.
- **Others** need an **active (confirmed) membership** plus an **active grant** (not revoked, not expired) for the
  exact category. Grants default to +90 days, max +365 days.
- **Caregivers** can never hold `scam_checks` / `transfer_pauses`. Creating one returns 403 `CAREGIVER_FORBIDDEN`,
  and a row that bypassed this is still ignored.
- **Admin / org_admin** never read or receive content. `/admin/overview` returns counts only.
- Check-ins: `onlyMe` rows are excluded **in SQL** for everyone else. A note is shown only when `noteShared`. Grantees
  get `SharedCheckinDTO` with no flags.
- Scam checks and pauses are shared **per recipient** (`content_shares`), re-checked on every read. Recipients must be
  confirmed, non-caregiver members holding the grant, or the senior gets a generic 400. Grantees never get
  `submittedText` (raw text is stored but returned only to the senior, defanged), the exact amount (they get
  `amountBucket`), the answers, or `recipientNote`.
- Every successful read of another person's data writes an **access-log** row (viewer × category × UTC day,
  deduplicated, latest time kept).
- Notifications: Signal → rule (`ALERT_KIND_CATEGORY`) → consent check → Alert + Notification (`queued`) → pg-boss
  worker → simulated adapter → `sent` or retry with backoff → `failed`. Consent is re-checked at delivery
  (`cancelled_no_consent`), read and ack. A revoke, expiry or deletion makes existing notifications
  `contentUnavailable` with one generic text. A help request with no eligible recipients returns `noRecipients: true`
  and queues nothing. If no one acknowledges within `HELP_FOLLOWUP_MINUTES`, a follow-up goes to the next permitted
  member (by join order) who has not had one yet.
- Dashboard: computed per viewer from visible categories only. `assistance_requested` > `verify_possible_scam` >
  `check_in_recommended` (latest shared mood lonely/worried) > `no_action_needed`; `not_shared` if the viewer holds no
  relevant grant. Missing data → `latestCheckin: null` and `no_action_needed`.
- AuditEvents are append-only: the code only inserts, and a DB trigger rejects UPDATE/DELETE. The seed and test reset
  use TRUNCATE on SYNTHETIC data only.
