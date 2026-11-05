# FGAI-2026-001 — Discovery, Scope & User Stories (v0.1)

| Field | Value |
|---|---|
| Project ID | FGAI-2026-001 |
| Deliverables | §1 Repository assessment · §2 Assumptions & blockers · §3 MVP scope & exclusions · §4 User stories & acceptance criteria |
| Author | Claude Code (Lead Engineering Agent), draft |
| Date | 2026-11-05 |
| Status | **DRAFT — awaiting SCOPE gate (Product Owner)** |
| Next human reviewer | Product Owner (founder) |

---

## 1. Existing repository assessment

**What I inspected (2026-11-05):**

| Location | Finding | Consequence |
|---|---|---|
| `~` (home) and `~/Documents`, `~/Desktop`, `~/Downloads` | No FamilyGuardian / FGAI repository exists. A text search for "familyguardian / FGAI" only matched unrelated Lighthouse JSON in TELCO QA output. | Greenfield project. |
| `~/Documents/Claude/Projects/TELCO_Claude_Hybrid_Agency_v2` | An established governance framework: `CLAUDE.md`, `config/agents.yaml` (A00–A15), `config/gates.yaml` (SCOPE→DESIGN→ARCH→QA→UAT→RELEASE, 0 critical/high open), `config/rbac.yaml`, `.claude/agents/a00…a15.md`. Active client project WEB-TELCO-001 lives there. | **Use its gate model and agent roles as the template, but do not write into that repo.** Its CLAUDE.md rule 6 ("protect client separation, one project at a time") forbids mixing projects. |
| Host toolchain | Node v24.16.0 via nvm (not on non-interactive PATH); Docker 29.8.2 running with `node:22-*` and `postgres:17-alpine` images present; git 2.50; no local `psql`/`pnpm`. | Run the MVP through Docker Compose (Postgres + API + web), with nvm Node as an option for local dev. Nothing needs installing system-wide. |

**Action taken:** created a new, separate workspace at
`~/Documents/Claude/Projects/familyguardian-ai/` (git initialised, no commits yet). It holds only planning documents and a gate config. **No application code has been written, because SCOPE, DESIGN and ARCH have not been approved.**

---

## 2. Assumptions and unresolved blockers

### 2.1 Working assumptions (change them by editing this list at the SCOPE gate)

| # | Assumption | Why it matters |
|---|---|---|
| A1 | FGAI is a **separate project** from TELCO. It shares no agents, data, deploy targets or the "Lucy" delegate routing unless the owner says otherwise. | Client separation |
| A2 | The MVP is a **local and staging demo** for evaluation and ENT501, using synthetic data only. No production launch is in scope. | RELEASE gate stays closed |
| A3 | **Web PWA first** (Next.js). Expo mobile is deferred to P2 and introduced only when push, IAP or native calling need it. | Lower cost; IAP rules apply only to native apps |
| A4 | ScamShield works **without any AI provider** through a deterministic rules engine. An LLM, if approved, only adds plain-language explanation and can never lower a rules-based risk level. | Testable, offline, safe fallback |
| A5 | "Call trusted contact" opens a `tel:` link and logs **"Call started from app"**. The app cannot know whether the call connected, so it never says "Call completed". | Honest status labels (AC-7, AC-11) |
| A6 | Push and email in the MVP are **simulated adapters** that write auditable delivery states. Real providers (Web Push/FCM/email) wait for approval and credentials. | No external messages without approval |
| A7 | Payments run as a **sandbox provider only** (signed simulated webhooks). Real gateways (Omise, 2C2P, GB Prime Pay, etc.) need contracts, credentials and approval. | §7 of the directive |
| A8 | Authentication for the MVP is first-party (Argon2id password + server-side sessions + invite tokens) behind an interface that a managed IdP can replace in P1. | Avoids an external account and keys for the demo |
| A9 | Thai is the primary UI language and English is secondary. Thai copy must be reviewed by a native speaker and ideally by 2–3 older adults before the DESIGN gate. | Accessibility and comprehension |
| A10 | The pricing (Free / ฿199 / ฿349 / B2B) is a **hypothesis to validate**, not a decision. | Research honesty |

### 2.2 Blockers — need a human decision

| # | Decision | Default if unanswered | Blocks |
|---|---|---|---|
| B1 | **Gate signatories.** Who signs SCOPE, DESIGN, ARCH, QA, UAT and RELEASE? If the founder signs everything, independence is weaker. Record that, and preferably add an outside reviewer (advisor or classmate) for QA and Security. | Founder signs SCOPE/DESIGN/UAT. QA and Security get an independent read-only agent review **plus** a named human reviewer still to be chosen. | SCOPE |
| B2 | **AI provider for the ScamShield explanation layer**: (a) rules only, or (b) Anthropic API with a dev key and synthetic data only. | (a) rules only. (b) is behind a feature flag and off by default. | ARCH |
| B3 | **Deadline and audience**: ENT501 presentation date, and whether the 30-family pilot is a real plan (which needs ethics/consent forms) or a proposal. | Treated as a proposal document. | Backlog dates |
| B4 | **Verification of the official help directory.** Public sources confirm AOC **1441** (24-hour, phone only, no social-media presence) and police **191**. **1669** (medical emergency, NIEM) comes from general knowledge and still needs an official-source check. **Bank fraud-line numbers are not collected yet**: each must come from the bank's own website, and a human must record the URL and date. | Seed 1441, 191 and 1669 with `verification_status = "needs_human_verification"`. Show **no** bank numbers until a human verifies them. | UAT |
| B5 | **Legal / PDPA review.** Health and well-being check-ins are probably "sensitive data" under PDPA s.26 and need explicit consent. A qualified reviewer (DPO or lawyer) is needed before any real-user pilot. | Demo stays synthetic-only, so this does not block the MVP build but does block the pilot. | Pilot |
| B6 | **Hosting for staging** (e.g. a Thai/SEA region cloud, or Docker on a VPS). | Local Docker only. | RELEASE prep |

---

## 3. MVP scope and exclusions

### 3.1 In scope — delivered in reviewable increments

| Inc | Priority | Contents | Directive refs |
|---|---|---|---|
| **INC-0 Foundation** | P0 | pnpm monorepo; Docker Compose (Postgres 17, API, web); DB schema and migrations; auth (register, login, logout, session expiry); roles; **consent/permission policy engine**; audit events; seed script with synthetic demo accounts; CI test runner | §6, §9 |
| **INC-1 Senior core** | P0 | Welcome/language; senior home (6 tiles); daily FeelSense check-in with 6 options, optional note and per-check-in sharing choice; personal trend view; trusted contacts and one-tap call (`tel:`) with honest logging; Request Help; emergency directory screen | Mod A, B, G |
| **INC-2 Scam safety** | P0 | ScamShield text + URL + phone-number submission → rules engine → risk category, explanation, evidence, uncertainty, verification steps, "ask family" / "call 1441"; Guardian Pause 4-question simulation with clear warning and actions. **No live banking** | Mod D, E |
| **INC-3 Family Circle and alerts** | P0 | Invitations with verification code; granular grants (category × member × expiry); revoke; family dashboard showing only authorised data, with the label set from §4H; notification engine (signal → rule → consent check → notify → ack → follow-up/retry); notification centre; acknowledgement states | Mod F, H, I |
| **INC-4 Pilot features** | P1 | Medication/appointment reminders and care tasks (caregiver completes tasks); sandbox billing (plans, checkout, webhook, renew/cancel/refund states, family entitlement); admin dashboard (operational only, no PHI browsing); data export and deletion | Mod C, §7 |
| **INC-5 Hardening and docs** | P1 | Rate limiting, security headers, a11y audit (axe + manual), Playwright E2E for the critical journeys, OpenAPI docs, release-readiness checklist, known limitations | §6, §11 |
| **DOC track (parallel)** | — | Research and business deliverables from §12 (PRD, personas, BMC, ENT501 outline…). Evidence and hypotheses are labelled separately | §12 |

### 3.2 Explicitly excluded from the MVP (and why)

| Excluded | Reason | Where it goes |
|---|---|---|
| Reading, intercepting or blocking real bank transactions or OTPs; storing bank passwords | Prohibited by the directive; needs a bank partnership | P2, bank partner only |
| Automatic reporting to police, hospital, bank or AOC; any case or receipt numbers | No authorised integration exists. Fabricating them is forbidden | P2, verified partner API + legal review |
| Emotion inference from voice, behaviour or text; depression screening; diagnosis | Prohibited (no emotional certainty claims, no diagnosis) | Not planned |
| Location tracking, call recording, reading SMS/LINE, social-media monitoring | Coercive-surveillance risk; prohibited | Not planned |
| Screenshot OCR for ScamShield | Extra data-handling and privacy risk; not P0 | P1 option (on-device OCR preferred) |
| Server-side fetching or "opening" of submitted URLs | SSRF and malware risk. The MVP analyses the URL **string** only | P2 via vetted reputation API |
| Whoscall-type caller ID, health-data integrations (Apple Health / Health Connect), clinical integrations | Need partner approval | P2 |
| Real payment providers, Apple IAP / Google Play Billing | Need contracts, credentials and native apps | P2 |
| Native mobile app (Expo) | Not needed for the P0 demo | P2 |
| Production deployment | RELEASE gate | After UAT |

---

## 4. User stories and acceptance criteria

Format: **ID — As a … I want … so that …**, then testable acceptance criteria (Given/When/Then, abbreviated). The "AC#" column maps to the directive's §11 completion criteria.

### Senior (primary user) — persona "Khun Somsri", 72, demo account

| ID | Story | Acceptance criteria | AC# |
|---|---|---|---|
| S-01 | Sign in with a simple method so that I can use the app on my own | Given seeded senior credentials, when I sign in, I land on Home with no more than 6 large tiles. The session expires after inactivity (configurable; 30 days for remembered device in the demo). Error messages are in plain Thai | 2 |
| S-02 | Do a daily check-in in under a minute without help | From Home → "วันนี้เป็นอย่างไรบ้าง" → choose one of 6 options (incl. "ไม่อยากตอบ") → optional note → **choose who sees it** (default = **"only me"**; the senior picks "share with [names]" each time — owner decision 2026-11-05) → confirmation. No more than 3 taps for the minimum path. Works by keyboard and screen reader. Once saved, the result appears in my trend | 3 |
| S-03 | See my own trend | The trend shows only what I entered. Gaps show as "ไม่มีข้อมูล" (no data), never as a decline. No diagnostic wording | — |
| S-04 | Check a suspicious message | I paste text and/or a URL/phone number → I get a risk category (`low_signals` / `caution` / `high_risk` / `cannot_assess`), plain reasons with quoted evidence, an uncertainty statement, verification steps, and buttons for "ask family" and "call 1441". The result **never says "safe"**. Lowest wording: "ไม่พบสัญญาณเสี่ยงที่ชัดเจน — แต่ยังควรตรวจสอบ" | 5 |
| S-05 | Pause before a money transfer | I enter an amount and answer the 4 questions. With 2 or more risk answers, or a "secret" answer, I see a calm but clear warning plus Stop & Verify / Call family / Bank (verified directory) / 1441. Nothing touches a bank. The session is saved and can be shared if I choose | 6 |
| S-06 | Call a trusted person in one tap | Tapping a contact opens the phone dialler (`tel:`). The log says "เริ่มโทรจากแอป" with a timestamp, never "connected" | 7 |
| S-07 | Ask for help | "ขอความช่วยเหลือ" sends an alert to the contacts I chose for that purpose. I see real states: Queued → Sent → Seen/Acknowledged by [name] → or "No one has acknowledged yet — call 1669 if urgent" | 8 |
| S-08 | Reach emergency numbers | The emergency screen lists 1669 / 191 / 1441 with their purpose and verification date. Tapping one opens the dialler. **No screen ever states that an agency received a report** | 11 |
| S-09 | Control who sees what | Privacy screen: a member × category matrix (check-ins, reminders, scam checks, help requests, transfer pauses) with an expiry date. I can revoke in one action. I can see "who viewed my info" | 4, 9 |
| S-10 | Export or delete my data (P1) | Export gives JSON of all my records. Delete hides my data at once and purges it after the retention window, with an audit event | — |

### Family member — persona "Nok", daughter in Bangkok

| ID | Story | Acceptance criteria | AC# |
|---|---|---|---|
| F-01 | Accept an invitation | The invite link plus a 6-digit code (shared by the senior out of band) creates a membership. Without the senior's grants I see **nothing** except name and "no shared info" | 2, 4 |
| F-02 | See only what is shared with me | The dashboard shows only categories with an active, unexpired grant. Status labels come only from the approved set ("No Action Needed", "Check In Recommended", "Assistance Requested", "Verify Possible Scam"). A missing check-in shows "ยังไม่มีการเช็กอินวันนี้" (no check-in today) with neutral styling | 4 |
| F-03 | Lose access when the senior revokes | After a revoke, my next API request for that category returns 403. Data already shown disappears on refresh. Already-delivered notification bodies are reduced to "content no longer shared" | 9 |
| F-04 | Acknowledge an alert | Clicking "รับทราบ" marks it acknowledged with my name and time. The senior sees it. Unacknowledged alerts follow the configured follow-up (retry, then next contact) | 8 |
| F-05 | Help verify a scam | When the senior shares a scam check, I see the assessment and can reply "I'll call you" or "This is not me / not our bank" | 5 |

### Caregiver — persona "Pim", part-time carer

| ID | Story | Acceptance criteria | AC# |
|---|---|---|---|
| C-01 | See my assigned care tasks (P1) | I see only tasks and reminders the senior granted to "care tasks". No access to scam checks, transfer pauses, finances or check-in notes (enforced by the API, tested) | 2, 4 |
| C-02 | Record task completion | Marking a task done records who did it and when. The senior and authorised family see it | — |
| C-03 | Acknowledge help requests | If granted "help requests", I can acknowledge them like a family member | 8 |

### Administrator / Org admin

| ID | Story | Acceptance criteria |
|---|---|---|
| AD-01 | Operate the platform without reading private data (P1) | The admin UI shows counts, queue health, failed deliveries and the directory editor. Check-in content, notes and scam text are **not** returned by admin endpoints (test). Every admin action writes an audit event |
| AD-02 | Maintain the help directory | Each entry needs a source URL, verifier name and verification date. Unverified entries show a visible "not yet verified" badge |
| OA-01 | B2B admin (P2 stub) | Licence counts and aggregate stats only, with a minimum cohort size (k ≥ 10) before any number is shown |

### Cross-cutting acceptance (maps to directive §11)

1. `docker compose up` plus the documented seed command start the app (AC-1).
2. Seeded roles: senior, family ×2 (one with grants, one without), caregiver, admin. All data is synthetic, and the seed file is marked as such (AC-2, AC-14).
3. Automated tests run with one command. The report attached to each increment shows real pass/fail counts (AC-12).
4. Security and accessibility findings live in `docs/safety/` with their status (AC-13).
5. `docs/KNOWN_LIMITATIONS.md` exists before UAT (AC-15).
