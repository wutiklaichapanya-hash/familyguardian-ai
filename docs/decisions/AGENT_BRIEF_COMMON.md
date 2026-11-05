# Common brief for every FGAI agent (read this first)

Project: FamilyGuardian AI (FGAI-2026-001). Repo: ~/Documents/Claude/Projects/familyguardian-ai
Read: docs/product/01_DISCOVERY_AND_SCOPE.md, docs/architecture/03_ARCHITECTURE.md, docs/product/04_UX_SPEC.md, docs/safety/02_THREAT_MODEL.md, packages/shared/src/*.ts (THE CONTRACT), docs/decisions/DECISIONS_LOG.md.

## Shell setup (every Bash call)
export NVM_DIR=~/.nvm; . $NVM_DIR/nvm.sh >/dev/null; export PATH=~/.local/bin:$PATH
(Node 24, pnpm 12. Postgres 17 runs in Docker at localhost:5433, user fg / pw fg_local_only, db familyguardian. Root .env exists.)

## Rules
- Write ONLY inside the directories you own (listed in your task). Other agents work in the same tree at the same time.
- The contract lives in packages/shared/src. Do not edit it. If it is missing something, work around it locally and list the change you want in your final report.
- Dependencies are already installed. If you really need a new one, run `pnpm --filter <your-package> add <dep>`. If it fails because of a lock or a concurrent install, wait 20s and retry. Never delete node_modules or the lockfile.
- No git commits. The lead agent commits.
- Synthetic data only. No real names, phone numbers (use 0xx-xxx-xxxx fictitious numbers such as 081-000-0001), health or bank data. The official help numbers 1669 / 191 / 1441 are allowed but must carry verification = 'needs_human_verification'.
- Product rules: no "safe" verdicts, no diagnosis, no claims that agencies were notified, no fake case numbers, missing data is never shown as decline, the senior owns all sharing.
- Don't kill processes you didn't start. Ports: API 4100, web 3100, DB 5433.
- Final report: what you built (file list), the exact test commands and their ACTUAL output summary (pass/fail counts), known gaps, and contract-change requests. Never claim something works without having run it.

## Demo accounts (synthetic — every agent uses exactly these)
| email | password | role | notes |
|---|---|---|---|
| somsri@demo.fg | Demo-Senior-2026 | senior | "สมศรี (Somsri)", th, politeParticle ka, owns the family |
| nok@demo.fg | Demo-Family-2026 | family | "นก (Nok)", daughter; grants: checkins, help_requests, scam_checks, transfer_pauses, contacts |
| anan@demo.fg | Demo-Family-2026 | family | "อนันต์ (Anan)", son; member with ZERO grants |
| pim@demo.fg | Demo-Care-2026 | caregiver | "พิม (Pim)"; grants: help_requests, care_tasks |
| admin@demo.fg | Demo-Admin-2026 | admin | operational only |
