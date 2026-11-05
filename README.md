# FamilyGuardian AI (FGAI-2026-001)

**Care Beyond Distance. Protect Without Controlling.**

FamilyGuardian AI is a web app (PWA) for Thai older adults and the family members and
caregivers who look out for them from a distance. The senior does a daily well-being
check-in, checks suspicious messages with ScamShield, pauses before a money transfer
(Guardian Pause), and asks for help in one tap. Family members see **only** what the senior
chooses to share, category by category, and the senior can revoke that at any time. The
senior owns all sharing.

## Status

- **MVP in development.** Backend, web app and AI rules are being built in parallel right now.
  Features described below are **planned / in development** unless a test report says
  otherwise. See [`docs/architecture/RELEASE_READINESS.md`](docs/architecture/RELEASE_READINESS.md)
  for what has actually been verified.
- **Synthetic data only.** Never enter real names, phone numbers, health or bank information.
- Gates: SCOPE is signed. DESIGN, ARCH, QA, UAT and RELEASE are **not** signed
  ([`config/gates.yaml`](config/gates.yaml), [decisions log](docs/decisions/DECISIONS_LOG.md)).
  Nothing is deployed anywhere; it runs on your machine.

## Quick start (local)

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 (≥ 22 works) | via [nvm](https://github.com/nvm-sh/nvm) |
| pnpm | 12 | via corepack (ships with Node) |
| Docker | with Compose v2 | runs Postgres 17 on port **5433** |

```bash
# 1. Node + pnpm (nvm is not loaded in non-interactive shells; repeat in each new terminal)
export NVM_DIR=~/.nvm; . "$NVM_DIR/nvm.sh"
nvm install 24 && nvm use 24
corepack enable && corepack prepare pnpm@12.16.1 --activate

# 2. Configuration (local-only placeholder values)
cp .env.example .env

# 3. Install, database, seed
pnpm install
pnpm db:up          # Postgres 17 in Docker on localhost:5433
pnpm db:migrate
pnpm db:seed        # synthetic demo accounts (seed script in development)

# 4. Run (two terminals)
pnpm dev:api        # API on http://localhost:4100  (health: /api/health)
pnpm dev:web        # web on http://localhost:3100
```

Then open **http://localhost:3100**.

Optional, fully containerised API + web (profile `full`, stop the dev servers first):

```bash
docker compose -f infrastructure/docker-compose.yml --profile full up -d --build
```

The images build today. End-to-end use is **not working yet**: the API currently binds to
`localhost` inside its container, so the web container cannot reach it (tracked in
[`RELEASE_READINESS.md`](docs/architecture/RELEASE_READINESS.md), item R5). Ports, resets, backup/restore and common errors are in
[`docs/architecture/RUNBOOK_LOCAL.md`](docs/architecture/RUNBOOK_LOCAL.md).

## Demo accounts (synthetic)

Created by `pnpm db:seed`. These are fictitious people with documented, local-only passwords.

| Email | Password | Role | Who |
|---|---|---|---|
| `somsri@demo.fg` | `Demo-Senior-2026` | senior | สมศรี (Somsri). Thai UI. Owns the family circle and all sharing |
| `nok@demo.fg` | `Demo-Family-2026` | family | นก (Nok), daughter. Grants: check-ins, help requests, scam checks, transfer pauses, contacts |
| `anan@demo.fg` | `Demo-Family-2026` | family | อนันต์ (Anan), son. Member with **zero** grants: should see nothing shared |
| `pim@demo.fg` | `Demo-Care-2026` | caregiver | พิม (Pim). Grants: help requests, care tasks |
| `admin@demo.fg` | `Demo-Admin-2026` | admin | Operations only, no access to private content |

## Tests

```bash
pnpm typecheck            # tsc across the workspace
pnpm test                 # unit/integration (Vitest) in every package
pnpm test:e2e             # Playwright (chromium) against a seeded DB; starts dev servers if needed
pnpm audit --audit-level high
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs install, typecheck, unit
tests (Postgres 17 service), Playwright E2E, gitleaks, `pnpm audit` and semgrep. There is no
GitHub remote yet, so the workflow has **not run**. There is no deploy job: deploys need the
RELEASE gate and are not automated.

## Repository map

```
apps/web/              Next.js PWA: senior, family, caregiver and admin screens (th/en)
services/api/          Fastify API: auth, consent/policy engine, notifications, Drizzle migrations
packages/shared/       The API contract: zod schemas, types, labels, i18n strings
packages/ai/           ScamShield rules engine, prompts, eval set (LLM explainer off)
packages/payments/     Plans, entitlements, sandbox payment provider
tests/e2e/             Playwright journeys, authz matrix, a11y and safety checks
infrastructure/        docker-compose.yml (db; profile "full" adds api + web), Dockerfiles
config/gates.yaml      Gate model: SCOPE → DESIGN → ARCH → QA → UAT → RELEASE
docs/                  product, architecture, safety, research, business, decisions
.github/               CI workflow (no deploy)
```

## Documentation

**Planning pack (v0.1)**
1. [Discovery, assumptions, scope, user stories](docs/product/01_DISCOVERY_AND_SCOPE.md)
2. [Security & privacy threat model](docs/safety/02_THREAT_MODEL.md)
3. [Architecture recommendation](docs/architecture/03_ARCHITECTURE.md)
4. [UX design specification](docs/product/04_UX_SPEC.md)
5. [Backlog, QA/UAT strategy, approval checklist](docs/product/05_BACKLOG_QA_GATES.md)
- [PRD](docs/product/PRD.md)

**Safety and security**
- [Threat model](docs/safety/02_THREAT_MODEL.md)
- [Independent security & privacy design review #01](docs/safety/SECURITY_REVIEW_01_design.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)

**Decisions, release and operations**
- [Decisions log](docs/decisions/DECISIONS_LOG.md)
- [Release readiness checklist](docs/architecture/RELEASE_READINESS.md)
- [Local runbook](docs/architecture/RUNBOOK_LOCAL.md)

## What this MVP does NOT do

- **No bank access.** It never reads, intercepts, pauses or blocks real transactions, OTPs or
  bank accounts, and never asks for bank passwords. Guardian Pause is a reflection checklist.
- **No agency reporting.** Nothing is sent to police, hospitals, banks or the AOC. There are
  no case or receipt numbers. Emergency numbers (1669, 191, 1441) open your phone's dialler and
  are marked as awaiting human verification.
- **No diagnosis.** No medical or mental-health assessment and no emotion inference.
  Check-ins are what the senior chooses to report; missing days show as "no data".
- **No "safe" verdict.** ScamShield shows risk signals and how to verify. It can be wrong.
- **Simulated notifications and payments.** Push/email deliveries are simulated and recorded
  in the database; nobody's phone actually receives them. Billing is a sandbox; no money moves.
- **No surveillance.** No location tracking, call recording, or reading of SMS/LINE.
- **No real AI provider by default.** The optional LLM explainer is off and needs owner
  approval plus closed security items before it can be enabled.

Full list: [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md).
