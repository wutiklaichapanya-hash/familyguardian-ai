# FGAI-2026-001 — Local runbook

Scope: the **local** Docker + host-Node setup only. There is no staging or production
environment (blocker B6, RELEASE gate closed). Everything here touches synthetic data only.

Container names below assume the compose project name `familyguardian` (set in
`infrastructure/docker-compose.yml`), so the database container is `familyguardian-db-1`.
There is no local `psql` / `pg_dump` on the host, so every database command runs **inside**
the container with `docker exec`.

## 1. Ports and services

| Service | Port (host) | How it runs | Health |
|---|---|---|---|
| Postgres 17 (`db`) | `5433` → container 5432 | `pnpm db:up` (Docker, volume `familyguardian_fgdata`) | `pg_isready -U fg -d familyguardian` (compose healthcheck) |
| API (Fastify) | `4100` | host: `pnpm dev:api` · Docker: profile `full` | `GET http://localhost:4100/api/health` → `{"status":"ok","db":"ok",…}` |
| Web (Next.js PWA) | `3100` | host: `pnpm dev:web` · Docker: profile `full` | `GET http://localhost:3100/` |

Local DB credentials (local-only, also in `.env.example`): user `fg`, password `fg_local_only`,
database `familyguardian`.

## 2. Shell setup (every new terminal)

Node comes from nvm, which is not on the PATH of non-interactive shells:

```bash
export NVM_DIR=~/.nvm; . "$NVM_DIR/nvm.sh" >/dev/null; export PATH=~/.local/bin:$PATH
node -v   # v24.x
pnpm -v   # 12.x
```

## 3. Everyday commands

```bash
pnpm db:up                 # start Postgres only (does not touch the API/web)
pnpm db:migrate            # apply services/api/drizzle/*.sql
pnpm db:seed               # synthetic demo accounts (see README)
pnpm dev:api               # API on :4100 (reads ../../.env)
pnpm dev:web               # web on :3100
```

Containerised API + web (optional, profile `full`; stop the host dev servers first because
the ports are the same):

```bash
docker compose -f infrastructure/docker-compose.yml --profile full up -d --build
docker compose -f infrastructure/docker-compose.yml --profile full ps
docker compose -f infrastructure/docker-compose.yml --profile full stop api web   # stop only app containers
```

Migrations and seed still run from the host against `localhost:5433`.

## 4. Reset the database (destructive, local only)

Pick the smallest reset that solves the problem. Each step deletes **all** data in the
local `familyguardian` database. Stop `pnpm dev:api` first so it releases its connections.

**4a. Drop and recreate the database (keeps the Docker volume):**

```bash
docker exec familyguardian-db-1 psql -U fg -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS familyguardian WITH (FORCE)" \
  -c "CREATE DATABASE familyguardian OWNER fg"
pnpm db:migrate && pnpm db:seed
```

**4b. Reseed only** (keeps the schema). Whether `pnpm db:seed` is idempotent is defined by
the backend's seed script (`services/api/src/db/seed.ts`, in development). If it is not, use 4a.

**4c. Wipe the whole Docker volume (last resort).** This removes the volume
`familyguardian_fgdata` and everything in it:

```bash
docker compose -f infrastructure/docker-compose.yml down -v   # DESTROYS the local DB volume
pnpm db:up && pnpm db:migrate && pnpm db:seed
```

Note that `pnpm db:down` runs `docker compose down` (no `-v`): it removes the containers but
keeps the volume.

## 5. Backup and restore (local Docker volume)

Logical backups with `pg_dump` custom format (`-Fc`) are preferred over copying the volume:
they are portable, consistent while the DB is running, and can be restored selectively.

### 5.1 Back up

```bash
BACKUP_DIR=./backups            # git-ignored location of your choice, never commit dumps
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker exec familyguardian-db-1 pg_dump -U fg -d familyguardian -Fc --no-owner \
  > "$BACKUP_DIR/familyguardian_$STAMP.dump"
shasum -a 256 "$BACKUP_DIR/familyguardian_$STAMP.dump" > "$BACKUP_DIR/familyguardian_$STAMP.dump.sha256"
docker exec -i familyguardian-db-1 pg_restore --list < "$BACKUP_DIR/familyguardian_$STAMP.dump" | head
```

Even with synthetic data, treat dumps as if they held personal data: keep them out of git
(`backups/` is not in `.gitignore` yet, so choose a path outside the repo or add it), and
delete them when no longer needed.

### 5.2 Restore into a scratch database first (always)

Never restore straight over the main database. Restore into a new database, check it, then
decide.

```bash
DUMP=./backups/familyguardian_<STAMP>.dump
docker exec familyguardian-db-1 psql -U fg -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE familyguardian_restore_test"
docker exec -i familyguardian-db-1 pg_restore -U fg -d familyguardian_restore_test \
  --no-owner --exit-on-error < "$DUMP"
# verify: tables, migration journal, a few row counts
docker exec familyguardian-db-1 psql -U fg -d familyguardian_restore_test -c "\dt public.*" \
  -c "select id, hash from drizzle.__drizzle_migrations order by id" \
  -c "select count(*) from users"
# clean up
docker exec familyguardian-db-1 psql -U fg -d postgres -c "DROP DATABASE familyguardian_restore_test"
```

### 5.3 Restore over the main database (only after 5.2 passed)

```bash
# stop pnpm dev:api / the api container first
docker exec familyguardian-db-1 psql -U fg -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS familyguardian WITH (FORCE)" \
  -c "CREATE DATABASE familyguardian OWNER fg"
docker exec -i familyguardian-db-1 pg_restore -U fg -d familyguardian \
  --no-owner --exit-on-error < "$DUMP"
curl -fsS http://localhost:4100/api/health   # after restarting the API
```

Notes:
- `audit_events` has a `BEFORE UPDATE OR DELETE` trigger (migration `0001_audit_append_only.sql`).
  `pg_restore` only INSERTs (COPY), so the trigger does not block a restore, and it is restored
  with the schema.
- If a newer migration exists than the dump, run `pnpm db:migrate` after restoring.

### 5.4 Rehearsal evidence (RELEASE gate: "rollback + restore rehearsal")

| Field | Result |
|---|---|
| Date (UTC) | 2026-11-05 13:17:13 → 13:17:31 |
| Performed by | DevOps / Release agent (not a human; a human must repeat this before RELEASE) |
| Source | `familyguardian` in `familyguardian-db-1` (postgres:17-alpine, `pg_dump` 17.11) — read only |
| Dump | `pg_dump -Fc --no-owner` → scratchpad file `familyguardian_rehearsal.dump`, 51,647 bytes, sha256 `f257ef04c65a8c806588bc2061973dc223cae92945bc003be49b57379d007bd3`, 151 TOC entries, exit 0, ~0.12 s |
| Target | **new** scratch DB `familyguardian_restore_test` (the main DB was never written to) |
| Restore | `pg_restore --no-owner --exit-on-error`, exit 0, no errors |
| Verification | Source vs restored: tables 20 = 20, public indexes 42 = 42, triggers 1 = 1 (`audit_events_append_only` present), public functions 1 = 1, constraints 47 = 47, enum types 15 = 15; `drizzle.__drizzle_migrations` 2 rows, hash list identical (md5 `f9e3c1a0…`); row counts identical |
| Cleanup | `DROP DATABASE familyguardian_restore_test` → exit 0; database list afterwards: `familyguardian, postgres, template0, template1` |
| **Limitation** | At rehearsal time the main DB was migrated but **not yet seeded (0 rows in users, families, consent_grants, audit_events, directory_entries)**. The rehearsal therefore proves the schema + migration-journal round trip, not a data round trip. Repeat after `pnpm db:seed` and compare per-table row counts before marking the RELEASE item done |

## 6. Common errors

| Symptom | Cause | Fix |
|---|---|---|
| `zsh: command not found: node` / `pnpm` (often in scripts, CI-like shells, agent shells) | nvm is only loaded by interactive shells | Run the shell setup in §2. For pnpm: `corepack enable && corepack prepare pnpm@12.16.1 --activate`, or use `~/.local/bin/pnpm` |
| `EADDRINUSE: address already in use :::4100` (or `:3100`) | a previous dev server, or the `full` compose profile, already holds the port | Find it: `lsof -nP -iTCP:4100 -sTCP:LISTEN`. Stop the process **you** started (Ctrl-C in its terminal), or `docker compose -f infrastructure/docker-compose.yml --profile full stop api web`. Don't kill processes you did not start |
| `Bind for 0.0.0.0:5433 failed: port is already allocated` | another Postgres on 5433 | `lsof -nP -iTCP:5433 -sTCP:LISTEN`; stop that one or change the host port in compose **and** `DATABASE_URL` |
| `Ignored build scripts: esbuild` during `pnpm install`, then tsx / drizzle-kit fail with an esbuild binary error | pnpm ≥ 10 blocks dependency build scripts until they are approved | `pnpm-workspace.yaml` already has `allowBuilds: { esbuild: true }`. If it still warns: `pnpm approve-builds` (select esbuild) then `pnpm rebuild esbuild`. Never delete the lockfile |
| `ECONNREFUSED 127.0.0.1:5433` from migrate/seed/API | DB container not running or not healthy yet | `pnpm db:up`, then `docker inspect -f '{{.State.Health.Status}}' familyguardian-db-1` until `healthy` |
| `password authentication failed for user "fg"` | the volume was initialised with a different password earlier | Use the password the volume was created with, or reset with §4c |
| API exits with `SESSION_SECRET must be at least 32 characters` | `NODE_ENV=production` (e.g. the `full` profile) with a short secret | Set a ≥ 32-char local value in `.env` |
| `docker compose … --profile full up` → `env file ../.env not found` | `.env` missing | `cp .env.example .env` |
| Web loads but every `/api/v1/*` call fails in Docker | rewrite target baked at build time | The web image is built with `API_BASE_URL=http://api:4100`; rebuild after changing it (`--build`) |

## 7. What this runbook does not cover

Staging/production deploys, real secrets management, off-host backups, backup encryption,
PITR/WAL archiving, and monitoring. They do not exist yet; see `docs/KNOWN_LIMITATIONS.md`.
