DRAFT — evidence vs hypothesis labelled; requires Product Owner review

# 07 — Ethical AI and Data Protection Assessment (DPIA-style)

| Field | Value |
|---|---|
| Scope | FamilyGuardian AI MVP (P0 modules A, B, D–I) and P1 additions (C reminders, export/delete, billing sandbox, optional LLM explainer), as used in the proposed 30-family pilot |
| Assessor | Product & Research Agent (draft). **This is not legal advice.** |
| Required reviewers | A qualified Thai DPO or data-protection lawyer (B5); the independent Security/Privacy reviewer; a regulatory expert for §10; the PO to accept residual risk |
| Related | Threat model `../safety/02_THREAT_MODEL.md`; architecture retention table `../architecture/03_ARCHITECTURE.md` §5; pilot `06_*` |

> **Legal statements here come from secondary sources** and must be confirmed by a qualified reviewer before any real-user processing. Where a statement is about Thai law it is tagged [Secondary-legal].

---

## 1. Description of processing

| Purpose | Data subjects | Processing | Module |
|---|---|---|---|
| P1 Account and authentication | Seniors, family, caregivers, admins | Register, sign in, sessions | Foundation |
| P2 Voluntary well-being check-in and personal history | Seniors | Store self-reported option, optional note, sharing choice | A |
| P3 Connect and call logging | Seniors; trusted contacts (third parties) | Store contact name and number; log "call started from app" | B |
| P4 Reminders and care tasks (P1) | Seniors, caregivers | Store medicine/appointment reminders and task completion | C |
| P5 Scam message assessment | Seniors; **third parties named in messages** | Rules engine on text, URL strings and phone numbers; store result; raw text for 30 days | D |
| P6 Guardian Pause | Seniors | Store amount bucket, answers, optional recipient name | E |
| P7 Family Circle and consent management | All | Invitations, grants (member × category × expiry), revokes, "who viewed" log | F |
| P8 Request Help and emergency directory | Seniors, recipients | Alert to the chosen contacts; directory display | G |
| P9 Dashboard and notifications | Family, caregivers | Derive one of 4 labels from shared signals; deliver notifications | H, I |
| P10 Operations and security | All | Audit events, rate limiting, error logs (redacted) | — |
| P11 Pilot research (if approved) | Participants | Tests, surveys, interviews, pseudonymised usage aggregates | `06_*` |
| P12 Optional AI explanation (P1, off by default) | Seniors; third parties in messages | Redacted text sent to an external LLM provider | D |

**Purposes we explicitly do not pursue:** advertising, profiling for marketing, sale of data, emotion inference, health risk scoring, credit or insurance decisions, location tracking.

## 2. Data inventory

| Data item | Category | Sensitive? [Secondary-legal] | Source | Retention (proposed, architecture §5) |
|---|---|---|---|---|
| Name, email, password hash, role, language | Identity / account | No | User | Account lifetime + 30 days |
| Family relationships and memberships | Relationship | No in law, **but it reveals vulnerability** | Senior | Family lifetime |
| Consent grants (who sees what, expiry, consent version) | Consent record | No | Senior | 2 years after expiry (metadata) |
| Trusted contacts (name, phone) | **Third-party** personal data | No | Senior | Until removed |
| Check-in option (Happy / Okay / Lonely / Worried / Tired / Prefer not) and note | **Possibly health data** | **Likely yes**, treat as sensitive | Senior | 12 months rolling |
| Medication and appointment reminders | **Health data** | **Yes** | Senior / caregiver | 12 months after completion |
| Scam submission text, URL strings, phone numbers | May contain third-party data and financial context | Usually no in law; **high practical sensitivity** | Senior | Raw text 30 days; signals and category 12 months |
| Guardian Pause (amount bucket, answers, optional recipient name) | Financial-vulnerability context | No in law; **high practical sensitivity** | Senior | 90 days |
| Help requests, alerts, acknowledgements | Safety events | Context-dependent | System | 12 months |
| Audit events (incl. "who viewed") | Security | No | System | 2 years |
| Sandbox billing data | Commercial (synthetic) | No | System | Purgeable |
| Research data (tests, surveys, interviews) | Research; may include loneliness and health items | Likely yes for some items | Participant | Per ethics committee |

**Not collected:** national ID, bank account numbers, card data, OTPs, passwords for other services, location, contacts book import, SMS/LINE content beyond what the user pastes, voice, photos (MVP).

## 3. Lawful basis (Thailand PDPA)

[Secondary-legal] Per secondary sources, the Thai PDPA treats **health data, disability, biometric and genetic data, criminal records, religious beliefs** and other categories as sensitive personal data, and processing them generally requires the data subject's **explicit consent** unless a narrow exception applies (e.g. preventing danger to life, body or health; legal claims; specified legal obligations). As reported by Tilleke & Gibbins (1 Nov 2022): https://www.tilleke.com/insights/thailand-operationalising-pdpa-lawful-basis-sensitive-personal-data-and-data-processing-safeguards/26/. That article does not cite section numbers; the attribution to **s.26** comes from other secondary sources listed in the threat model §7 (e.g. Mondaq, Law Over Borders 2025: https://www.mondaq.com/data-protection/1590812/law-over-borders-data-protection-2025-thailand). **A qualified reviewer must confirm all of this.**

| Purpose | Proposed basis (to confirm) | Notes |
|---|---|---|
| P1, P10 | Contract (providing the service), legitimate interest for security | — |
| P2 check-in, P4 reminders | **Explicit consent** (treated as sensitive, as a precaution) | A separate, unticked consent step; versioned text; withdrawable in one action |
| P3 trusted contacts | Senior's consent and legitimate interest; third parties are informed? | **Open question:** must trusted contacts be notified that they were added? Proposal: notify them by invite only when they join |
| P5 scam checks | Consent (the senior submits the text) | Third-party data in messages: minimise (30-day raw retention, no sharing by default) |
| P6 Guardian Pause | Consent | — |
| P7–P9 sharing with family | **Consent per grantee × category**, with expiry | Sharing of sensitive categories needs explicit consent per grant |
| P8 Request Help | Consent; possibly vital interest | Must not rely on vital interest for routine alerts |
| P11 research | Explicit research consent (ethics) | Separate from app consent |
| P12 AI provider | Explicit consent **plus cross-border transfer assessment** | [Secondary-legal] Transfers abroad need adequate protection or safeguards (Tilleke, above). Off by default; synthetic data only in the MVP |

Other PDPA duties to confirm with the reviewer [Secondary-legal, unverified]: whether a DPO must be appointed (large-scale sensitive data processing may trigger it); breach notification timelines to the regulator; privacy notice content; data-subject rights handling times; records of processing.

## 4. Necessity and proportionality

| Question | Assessment |
|---|---|
| Is each data item needed for the purpose? | Yes for P0. Data minimisation choices: amount **bucket**, not the exact amount; no bank details; the URL is analysed as a string only; check-in notes are optional |
| Could the purpose be met with less data? | Possibly. (a) Check-in notes could be device-only. (b) Scam raw text could be deleted immediately after assessment instead of after 30 days. **Recommendation:** test whether the 30-day raw text retention is really needed (it helps if the senior wants to re-share); otherwise reduce it to "until the senior closes the result" |
| Is sharing proportionate? | Sharing is opt-in, granular and expiring. The dashboard shows labels rather than raw data by default |
| Is the retention proportionate? | Mostly. The 12-month rolling check-in retention should be justified to users ("so you can see your own history"), and a shorter option offered |
| Are there less intrusive alternatives? | Location tracking and inference were rejected (`03_*`). The design already chooses the less intrusive path |

## 5. Data-subject rights

Access and export (JSON, P1); rectification (edit profile and contacts); erasure (soft delete now, hard purge after the retention window); withdrawal of consent = revoke (immediate, also checked at delivery time); objection; and the senior's view of "who viewed my info". **Gap:** the rights of *third parties* (trusted contacts, people named in scam messages) need a process. Proposal: a contact form plus manual handling in the MVP.

## 6. Risks to individuals

Scores are [Estimate]: L = likelihood, S = severity, each 1–3.

| # | Risk | Who | L | S | Score |
|---|---|---|---|---|---|
| RI-1 | **Coercive control.** A relative pressures the senior to grant everything and uses the data to control finances, movement or relationships | Senior | 2 | 3 | **6** |
| RI-2 | **False reassurance.** The senior trusts a `low_signals` result and loses money, or the family sees "No Action Needed" and doesn't call | Senior, family | 2 | 3 | **6** |
| RI-3 | **Disclosure of sensitive data** through breach, admin snooping or lock-screen notifications | Senior | 1 | 3 | 3 |
| RI-4 | **Stigma / loss of dignity.** Being seen as "the one who gets scammed"; check-ins feel like a test | Senior | 2 | 2 | 4 |
| RI-5 | **Implied clinical judgement.** Copy or labels read as a diagnosis or mental-health assessment | Senior, family | 2 | 2 | 4 |
| RI-6 | **Missed help.** A help request is not delivered or acknowledged, and the senior assumes help is coming | Senior | 1 | 3 | 3 |
| RI-7 | **Fake help number.** A tampered directory sends the senior to a scammer | Senior | 1 | 3 | 3 |
| RI-8 | **Third-party data exposure.** Names and numbers inside scam messages, or trusted contacts' data | Third parties | 2 | 1 | 2 |
| RI-9 | **AI misbehaviour** (P1). Prompt injection, hallucinated advice or numbers, cross-border exposure | Senior | 2 | 2 | 4 (only if enabled) |
| RI-10 | **Exclusion.** People with low literacy, poor vision or no smartphone can't benefit; the app widens a digital divide | Seniors | 2 | 1 | 2 |
| RI-11 | **Caregiver over-reach**, or caregivers being suspected | Senior, caregiver | 1 | 2 | 2 |
| RI-12 | **Anxiety amplification.** Frequent warnings make the senior afraid of all messages | Senior | 2 | 2 | 4 |

## 7. Mitigations and residual risk

| Risk | Mitigations (existing = E, recommended = R) | Residual [Estimate] |
|---|---|---|
| RI-1 Coercion | E: only the senior can grant, with re-authentication; grants expire (90 days default, max 365); revoke is indistinguishable from expiry; private periodic review prompt; "who viewed" log; caregivers cannot hold financial categories; no location features. R: an onboarding moment shown only to the senior: "ถ้ามีใครบังคับให้แชร์ คุณยกเลิกได้ทุกเมื่อ" (if anyone forces you to share, you can cancel at any time); a quick "hide this screen" exit; pilot private-consent check (`06_*` §5) | **Medium.** Software cannot fully prevent coercion within a household. Accept with monitoring in the pilot |
| RI-2 False reassurance | E: no "safe" category; lowest wording "still verify"; uncertainty shown; the LLM can never lower risk. R: dashboard sub-line "based only on what [name] shared" (see `08_*` HS-03); UAT comprehension test of result wording | Medium–Low |
| RI-3 Disclosure | E: central policy engine; admin has no content access; minimal notification bodies; redacted logs; encryption at rest planned. R: app-level encryption for notes before the pilot (not P1 later) | Low |
| RI-4 Stigma | R: "checking is smart" framing; no streaks or scores; the family sees only what is shared | Low–Medium |
| RI-5 Clinical implication | E: forbidden-phrase test. R: the rules in `08_*` | Low |
| RI-6 Missed help | E: honest delivery states; "no one acknowledged yet, call 1669 if urgent"; follow-up to the next contact | Low–Medium (depends on family responsiveness) |
| RI-7 Fake number | E: admin-only directory with source, verifier and date; numbers never come from AI or free text | Low |
| RI-8 Third-party data | E: 30-day raw retention. R: shorter retention (see §4); redact phone numbers in shared views | Low |
| RI-9 AI | E: off by default; redaction; output schema validation; rules floor. R: a separate DPIA addendum and eval report before enabling with real users | Low (off) |
| RI-10 Exclusion | E: WCAG 2.2 AA; Thai first. R: assisted onboarding; read-aloud; offline community workshops | Medium (structural) |
| RI-11 Caregiver | E: forbidden categories enforced in the API | Low |
| RI-12 Anxiety | R: measure M2 (specificity) and M12 in the pilot; tone review | Low–Medium |

**Overall residual risk [Estimate]: Medium**, driven by coercive control and false reassurance. This is acceptable for a **consented, ethics-approved pilot with safeguarding**, but not for an open public launch until the pilot evidence is reviewed. The PO must record acceptance.

## 8. AI transparency

| Principle | Implementation |
|---|---|
| What "AI" means here | The MVP's ScamShield is a **deterministic rules engine** (decision B2: rules only). The product name contains "AI"; the UI must say in plain Thai: "ระบบตรวจตามรูปแบบที่พบบ่อย ไม่ใช่การรับรองความปลอดภัย" (checks against common patterns; it is not a safety guarantee) |
| Explainability | Every result lists the signals found, with quoted evidence and the uncertainty |
| Limits disclosed | It can miss new scams; it doesn't open links; it can't see the caller; it can't stop transfers |
| No hidden inference | No mood, health, cognitive or personality inference anywhere. Check-in data is shown back exactly as entered |
| LLM (if enabled later) | Labelled "AI-generated explanation"; it can only add explanation or raise risk; numbers come only from the directory; there is an eval set with published measured recall and false-positive rates |
| Model and rules changes | Versioned rules; every assessment stores the rules version |

## 9. Human oversight

- **The human decides.** The app never takes an action for the senior (no auto-blocking, no auto-reporting, no auto-sharing). Every share is a human choice.
- **Escalation is human-to-human.** Help requests go to people the senior chose; acknowledgement is a human act.
- **Operator oversight without content access.** Admins see queue health, failed deliveries and directory changes, not content.
- **Rules governance.** Changes to ScamShield rules and label logic need a review by the AI & Fraud owner plus the Healthcare Safety reviewer, and they need to pass the eval set and the forbidden-phrase test.
- **Pilot oversight.** A Safeguarding Lead; incident stopping rules; ethics reporting (`06_*` §8).

## 10. Medical-device regulation screening

**Question for a regulatory expert:** *Does FamilyGuardian (in particular Module A, the voluntary self-report check-in, and Module C, medication and appointment reminders) fall within the definition of a medical device, including software as a medical device (SaMD), under Thai law and Thai FDA guidance?*

What we found (secondary sources; **to be confirmed by an expert with the primary Thai FDA texts**):
- [Evidence, secondary] Per a 2011 Tilleke & Gibbins guide, software with medical applications was treated as a medical device under the Medical Device Act B.E. 2551 (2008), and the Thai FDA focuses mainly on the **intended purpose** of the product: https://www.tilleke.com/wp-content/uploads/2011/11/2011-LMGPG-MD-Thailand.pdf (dated; the law has since been amended).
- [Evidence, secondary, unverified blog] A JNM Global post reports that the Thai FDA issued SaMD registration guidelines on 9 May 2024, distinguishing standalone software (including mobile apps) from non-medical-device software: https://jnm-global.tistory.com/2499. **We could not access the primary text.**
- [Evidence] As reported by Tilleke & Gibbins (17 Jun 2026), new labelling rules with UDI requirements for SaMD in risk classes 2–4 take effect on 20 June 2026 (Government Gazette, 22 Dec 2025): https://www.tilleke.com/insights/thailand-introduces-udi-labeling-requirements-for-software-as-a-medical-device/3/. The article does not address wellness apps.
- **We found no Thai source on a "general wellness" exclusion.** We do not assume one exists.

**Why the MVP aims to stay a non-diagnostic wellness and safety tool [Hypothesis about regulatory effect]:**
1. The **intended purpose** is social connection, voluntary self-report and scam safety, not diagnosis, monitoring, prediction, prevention or treatment of a disease or condition.
2. The check-in has no scoring, no thresholds that indicate a condition, no clinical vocabulary, and no inference. It shows back only what the user entered.
3. Reminders are user-entered prompts with no dosage calculation, interaction checking, or adherence scoring sent to clinicians.
4. Marketing and in-app copy avoid claims such as "detects depression", "monitors health" or "prevents falls" (`08_*`).

**Design guardrails that keep this positioning** (any change triggers re-screening): no mood scoring or trend "decline"; no linking of moods to conditions; no symptom checker; no clinician dashboards; no integration with health devices (P2 needs separate screening); no medication advice.

**Required action:** before the pilot, a regulatory expert reviews the intended-use statement, the screens and the marketing copy against the current Thai FDA SaMD guidance, and records the conclusion in `DECISIONS_LOG.md`.

## 11. Sign-off (to be completed by humans)

| Role | Name | Decision | Date |
|---|---|---|---|
| DPO / data-protection lawyer | | ☐ Approve ☐ Changes needed | |
| Independent Security/Privacy reviewer | | ☐ | |
| Regulatory expert (§10) | | ☐ | |
| Product Owner (residual-risk acceptance) | | ☐ | |
