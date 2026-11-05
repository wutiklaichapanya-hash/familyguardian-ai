DRAFT — evidence vs hypothesis labelled; requires Product Owner review

# 06 — Pilot Plan: 30 Families × 30 Days (proposal)

| Field | Value |
|---|---|
| Status | **Proposal only** (decision B3, `DECISIONS_LOG.md` 2026-11-05). No participant may be recruited until the go/no-go checklist in §11 is fully signed |
| Owner | Product & Research (draft); Product Owner to approve |
| Required before start | Ethics committee approval; PDPA legal/DPO review (B5); DPIA (`07_*`) approved; QA and Security gates passed; staging hosting decided (B6); help-line numbers verified by a human (B4) |

> **Every target in this document is a "proposed target, not an outcome."** Nothing has been measured.

> **Note on the directive's §14 metrics.** The directive text is not stored in this repo. The metric set in §6 is the Product & Research Agent's proposal, built from the goals in PRD §2. **The PO must reconcile it with the directive's §14 list** and add any missing metric before ethics submission.

---

## 1. Objectives and research questions

| # | Question | Type |
|---|---|---|
| PQ-1 | Does using ScamShield and Guardian Pause for 30 days go along with a better ability to tell scam messages from legitimate ones? | Primary outcome (pre/post, not causal) |
| PQ-2 | Can older adults complete the core tasks unaided, and do they feel in control of their information? | Usability / autonomy |
| PQ-3 | Do family members find the four labels actionable, and how quickly do they acknowledge help requests? | Family value |
| PQ-4 | Do participants feel more connected, or less lonely? | Exploratory |
| PQ-5 | Does any harm occur (coercion, false reassurance, anxiety, privacy breach)? | Safety (always reported) |
| PQ-6 | What would families pay, and who pays (A10 hypothesis)? | Exploratory business question |

## 2. Design overview
- **Design:** a single-arm, pre/post feasibility pilot with mixed methods. [Hypothesis] It cannot prove causation, because there is no control group and retest/learning effects are likely.
- **Optional upgrade (PO decision):** a **wait-list control** (15 families start on day 0 and 15 on day 31; both groups do the recognition test on day 0 and day 30). This lets us compare app users with non-users over the same period. It costs about 30 extra days.
- **Unit:** one family = 1 senior (owner) + 1–3 family members + an optional caregiver.
- **Size:** 30 families (≈ 30 seniors and ≈ 45–60 family members) [Estimate]. With n = 30 paired senior observations, a paired test at α = 0.05 and 80% power can detect a standardised effect of about dz ≈ 0.53 (medium) [Estimate, standard power calculation; to be checked by a statistician]. Smaller effects may be missed.
- **Duration:** 30 days of use per family, plus onboarding and exit sessions.

## 3. Recruitment

| Item | Plan |
|---|---|
| Channels [Hypothesis about what works] | Community centres and older-persons' clubs (ชมรมผู้สูงอายุ), temple communities, university alumni and staff networks, workplace networks for adult children. **No cold calls or SMS**, because unsolicited contact looks like a scam and teaches the wrong habit |
| Entry point | Either the adult child or the senior may express interest, but **the senior is always approached and consented separately and privately** |
| Mix (target, not quota) [Estimate] | At least 10 seniors living alone; at least 10 aged 70+; urban and peri-urban; at least 5 with a caregiver |
| Incentive | A modest thank-you (e.g. a shop voucher) **not tied to app usage**, so there is no pressure to over-share. Amount set with the ethics committee |
| Language | All materials in Thai, with English versions for the record |

## 4. Inclusion and exclusion

**Senior: inclusion**
- Aged 60+ (Thai definition of older person).
- Lives apart from at least one participating adult family member, or alone.
- Owns or regularly uses a smartphone with internet.
- Able to give informed consent themselves, confirmed by a **teach-back** check (they explain the study back in their own words).
- Can read Thai, or is willing to use read-aloud with a helper during onboarding.

**Family member: inclusion.** Aged 18+; invited by the senior; consents separately.

**Exclusion (senior or family)**
- Unable to give their own informed consent (no proxy consent in this pilot).
- The senior indicates, in the private screening conversation, that they feel pressured to take part or to share with a particular relative (see the coercion check in §5).
- Currently involved in an active scam investigation or legal dispute about money with a family member.
- The research team's own close relatives, to avoid conflicts of interest (if this is relaxed, record it as a limitation).
- Anyone the safeguarding lead judges to be at immediate risk; they are given support and referral instead of enrolment.

## 5. Informed consent (including withdrawal)

| Element | How |
|---|---|
| Format | A plain-language Thai information sheet (large print, 20pt+), read aloud on request, plus a short video. Consent forms for seniors, family members and caregivers are separate |
| Private conversation | The researcher meets the senior **without the family present** for at least part of the consent visit and asks: "Is anyone pushing you to join or to share?" (รู้สึกว่ามีใครบังคับให้เข้าร่วมหรือให้แชร์ข้อมูลไหม) |
| Teach-back | The senior explains three things back: (1) what the app does and does not do, (2) that they choose what family sees, (3) how to stop |
| Layered consent | (a) Taking part in the study; (b) the app's own consent for each sharing category (in-app, versioned); (c) optional audio recording of interviews; (d) optional quotes in reports (anonymised) |
| Sensitive data | Explicit consent for well-being check-ins and any health reminders. [Per secondary sources, PDPA s.26 requires explicit consent for health data; to be confirmed by a qualified reviewer, see `07_*`] |
| Withdrawal | Any time, with no reason needed and no penalty (the thank-you is still given). Two channels: in-app "ออกจากการศึกษา" (leave the study) or telling the researcher. On withdrawal the participant chooses: **(i)** delete all their data, or **(ii)** keep already-collected de-identified research data. Default = delete. Family members' withdrawal does not affect the senior's participation, and vice versa |
| Ongoing consent | Re-confirmed at the day-15 check-in call |
| Capacity concerns mid-study | If the researcher has a concern, pause and consult the safeguarding lead; do not continue data collection until it is resolved |

## 6. Metrics and measurement methods

> **All targets are proposed targets, not outcomes.** See the reconciliation note at the top.

| # | Metric | Method | When | Proposed target (not an outcome) |
|---|---|---|---|---|
| M1 | **Scam-recognition accuracy** (senior) | Recognition test, §7 | Day 0, day 30 | Meaningful improvement in mean correct classification; the minimum effect size is set by the PO before unblinding |
| M2 | Recognition **specificity** (legitimate messages correctly judged legitimate) | Same test | Day 0, day 30 | No decrease. We don't want to make people afraid of all messages |
| M3 | Unaided completion of P0 tasks | Observed task script at onboarding and exit (check-in, scam check, Guardian Pause, call contact, change sharing) | Day 0, day 30 | ≥ 80% of seniors per task |
| M4 | Perceived autonomy / control | 5-point item: "ฉันควบคุมได้ว่าครอบครัวเห็นข้อมูลอะไร" (I control what my family sees) | Day 30 | ≥ 80% agree or strongly agree |
| M5 | Consent comprehension | 5-question quiz on what is shared, with whom, and how to revoke | Day 0 (after onboarding), day 30 | ≥ 4/5 for ≥ 80% of seniors |
| M6 | Loneliness / connectedness (exploratory) | A short validated loneliness scale. **A validated Thai version must be selected and its licence confirmed** (e.g. a Thai adaptation of the UCLA 3-item scale, if one exists and is validated; to verify) | Day 0, day 30 | Exploratory only; no target |
| M7 | Help-request acknowledgement time | System logs: time from `help_request_sent` to the first `alert_acknowledged` | Continuous | Report the median; no target |
| M8 | Family usefulness of labels | Family exit survey: "the labels helped me know when to reach out" (5-point) plus interview | Day 30 | ≥ 70% agree |
| M9 | Feature use (descriptive) | Counts of scam checks, pauses, check-ins, shares, revokes and "only me" choices, aggregated per family | Continuous | Report only. **No usage target**, to avoid nudging people to share |
| M10 | Retention | Any senior-initiated activity in week 4 | Day 22–30 | ≥ 60% [Estimate, for planning] |
| M11 | Safety incidents | Incident log (§8), plus an exit question: "did the app ever make you feel unsafe, watched or pressured?" | Continuous, day 30 | 0 serious incidents caused by the product; every incident reviewed |
| M12 | Perceived anxiety from the app | Exit item: "the app made me more worried" (5-point) | Day 30 | ≤ 20% agree |
| M13 | Willingness to pay (exploratory) | Van Westendorp-style questions to the payer (usually the adult child) | Day 30 | Exploratory |
| M14 | Real-world scam encounters (self-report) | Diary prompt / exit interview: "did you meet a suspicious message, and what did you do?" | Weekly, day 30 | Descriptive; **not** a claim of prevented losses |

**Analysis.** M1 and M2: paired comparison (paired t-test, or Wilcoxon signed-rank if the data are not normal), with effect size and 95% CI. Signal-detection measures (d′, criterion) separate real discrimination from a general "say scam to everything" bias. Qualitative data: thematic analysis by two coders. Results will be reported **as measured, including null or negative results.**

## 7. Scam-recognition test design (baseline vs after)

| Aspect | Design |
|---|---|
| Stimuli | **Synthetic** messages only (SMS, LINE-style chat, call script summaries). Each has a Thai version and is reviewed by a native speaker and an older-adult advisor. No real scam links: URLs are shown as non-clickable text using reserved example domains |
| Balance | Each form has 20 items: 10 scam (covering signals such as impersonation, urgency, secrecy, OTP request, link shortener, investment promise, prize, romance) and 10 legitimate (e.g. a genuine-style appointment reminder, a family message, a bank notice that asks for nothing) |
| Parallel forms | Two matched forms, **A and B**, equated on difficulty in a pre-test with 5–8 non-participant volunteers. Half the seniors get A at baseline and B at day 30; the other half get the reverse (counterbalanced). This limits memorisation |
| Response | For each item: "หลอกลวง / ไม่หลอกลวง / ไม่แน่ใจ" (scam / not scam / unsure) plus "what would you do?" (free text, coded: verify, ask family, call 1441/bank, ignore, act on it) |
| Administration | One-to-one, on paper or tablet, **without the app**, so we measure the person's own skill. Untimed. Large print. The researcher reads aloud if asked |
| Scoring | Correct classification (primary), d′ and criterion (secondary), "safe action" rate (secondary). "Unsure" is analysed separately and is not counted as wrong for the safe-action outcome |
| Blinding | The scorer doesn't know whether a sheet is baseline or follow-up (sheets are coded) |
| Debrief | After each test, every item is explained in a warm, non-judgemental way. **No one leaves feeling foolish** ("checking is smart") |
| Known limitations | Pre/post without a control (unless the wait-list option is chosen); practice effects; a lab test is not real-world behaviour; social desirability |

## 8. Safeguarding protocol

**Roles:** a named **Safeguarding Lead** (a qualified social worker, nurse or psychologist; to be recruited), and a deputy who is reachable during study hours. All researchers get safeguarding training before contact with participants.

**General rules**
- The consent sheet explains the **limits of confidentiality**: "If we believe you or someone else is in serious danger, we may need to get help."
- The app is not monitored by the research team in real time. Participants are told clearly: **"ทีมวิจัยไม่ได้เฝ้าดูแอปตลอดเวลา"** (the research team does not watch the app all the time).
- Researchers never take over a participant's phone, bank app or accounts.
- All help numbers given out must come from the human-verified directory (B4). The ones listed below are **marked `needs_human_verification`** until checked against official sources.

| Situation | Immediate action (researcher) | Escalation / referral | Record |
|---|---|---|---|
| **A real scam in progress** (e.g. the participant is on the phone with a "bank officer", or about to transfer) | Calmly suggest pausing: "ขอวางสายก่อนได้ไหมคะ แล้วเราค่อยตรวจสอบด้วยกัน" (Could you hang up first, and then we can check together?). Advise **not** to transfer or share OTPs. Encourage the participant to call their bank using the number on their card or the bank's official website, and AOC 1441 (needs_human_verification). Offer to sit with them while *they* call | Inform the Safeguarding Lead the same day. With the participant's permission, inform the family member they choose | Incident form within 24 h (no bank details recorded) |
| **Scam already happened** (money lost) | Acknowledge without blame. Encourage contacting the bank and 1441 / police 191 immediately (needs_human_verification). Explain that the app has **not** reported anything | Safeguarding Lead follows up within 48 h; offer to pause or continue participation | Incident form |
| **Disclosure of abuse** (financial, physical, psychological, neglect), including by a participating family member | Listen; don't investigate or confront anyone; don't promise secrecy beyond the consent terms; ask what the person wants; check immediate safety | Safeguarding Lead decides on referral with the participant, e.g. the social-assistance hotline 1300 (needs_human_verification), or police 191 if there is immediate danger. **Review the family's app grants privately with the senior.** Consider withdrawing the family from the study without disclosing why | Confidential safeguarding log, separate from research data |
| **Emotional crisis or self-harm risk** (e.g. "ไม่อยากอยู่แล้ว", "I don't want to live anymore") | Stay with the person (in person or on the phone); ask directly and kindly about safety; don't leave them alone if there is immediate risk | Immediate danger: 1669 (needs_human_verification). Otherwise the Department of Mental Health hotline 1323 (number and service hours need human verification). Safeguarding Lead the same day | Incident form; Safeguarding Lead review |
| **Medical emergency** | Call 1669 (needs_human_verification), or help the participant call | Inform the chosen family member with permission or if vital interests require it | Incident form |
| **The app may have caused harm** (false reassurance, a missed notification, a privacy leak) | Support the participant; record the facts | Report to the PO and the Security lead within 24 h. **Stopping rule:** any serious product-caused incident pauses enrolment and use until reviewed. Report to the ethics committee as its rules require | Incident + product bug ticket |

**Data typed into the app is not a safeguarding channel.** Free-text check-in notes are not read by humans or algorithms for risk. This must be stated in consent, and we must not imply any monitoring.

## 9. Data plan (synthetic → real only after legal review)

| Phase | Data | Condition to enter |
|---|---|---|
| **Phase 0: now** | **Synthetic only.** Seeded demo accounts; synthetic scam stimuli; UAT with synthetic data | Current state (A2) |
| **Phase 1: pre-pilot** | Recognition-test pre-test with volunteers (no app data) | Ethics approval |
| **Phase 2: pilot** | Real participant data in the app (check-ins, scam checks, pauses, grants, logs) plus research data (tests, surveys, interviews) | **All of:** PDPA review by a qualified DPO/lawyer (B5); DPIA (`07_*`) approved; QA and Security gates with 0 critical/high; staging hosting in an approved region with encryption at rest (B6); data processing agreements with any processor; AI explainer **off** (B2) unless separately assessed for cross-border transfer |

**Research data handling**
- App data and research data are kept **separate**. Research exports are pseudonymised (participant code), aggregated per family where possible, and exclude free-text notes and message bodies unless the participant gave specific consent.
- Key file (code ↔ identity) is held only by the PI, encrypted and stored apart from the data.
- Interview audio is transcribed, then the audio is deleted within 30 days [Estimate; ethics committee to confirm].
- Retention: research data for the period the ethics committee requires (often several years; to confirm). App data follows the architecture retention table, and participants are offered deletion at study end.
- No sale or secondary commercial use. Any publication reports aggregates only (minimum cell size 5 [Estimate]).

## 10. Ethics review

- [Hypothesis about requirements; to confirm] Research with older adults that collects sensitive personal data normally needs approval from a recognised **human research ethics committee** (for an ENT501 / university context, most likely the university's own IRB/EC). The PO must identify the right committee and its timelines.
- Submission pack: protocol (this document), information sheets and consent forms (Thai/English), recognition test forms, survey instruments, safeguarding protocol, DPIA (`07_*`), data management plan, researcher CVs and training certificates.
- Vulnerable-population points to address: autonomy and capacity, family coercion, the incentive amount, burden (session length ≤ 60 min with breaks), and debriefing.

## 11. Go / no-go checklist (all required)

- [ ] Ethics committee approval (reference number recorded)
- [ ] PDPA review by a qualified DPO/lawyer (B5) with written sign-off
- [ ] DPIA approved, residual risks accepted by the PO
- [ ] Medical-device screening answered by a regulatory expert (`07_*` §10)
- [ ] QA and Security gates passed (0 critical/high)
- [ ] Help directory verified by a human, with source URLs and dates (B4), including 1323 and 1300 if used
- [ ] Safeguarding Lead appointed and team trained
- [ ] Thai materials reviewed by a native speaker and older-adult advisors
- [ ] Metrics reconciled with directive §14 by the PO
- [ ] Insurance / liability position checked [Hypothesis; to confirm with an advisor]

## 12. Timeline (relative weeks; start date not set, B3)

```mermaid
gantt
  title Pilot timeline (placeholder start date, relative weeks only)
  dateFormat  YYYY-MM-DD
  axisFormat  W%W
  section Preparation
  Protocol, instruments, Thai review     :p1, 2027-01-04, 21d
  Ethics submission and review           :p2, after p1, 42d
  PDPA legal review and DPIA sign-off     :p3, 2027-01-04, 49d
  Recognition-test pre-test (volunteers) :p4, after p2, 7d
  section Recruitment
  Recruit and screen 30 families         :r1, after p4, 21d
  section Run
  Onboarding + baseline (day 0)          :o1, after r1, 7d
  30-day use with day-15 check call       :o2, after o1, 30d
  Exit: day-30 test, surveys, interviews  :o3, after o2, 7d
  section Analysis
  Analysis and report (incl. null results) :a1, after o3, 21d
  PO review and decision                   :a2, after a1, 7d
```

[Estimate] Total ≈ 22–24 weeks from protocol start to report; the ethics review timeline is the biggest uncertainty. The wait-list option adds about 5 weeks.

## Addendum (lead agent, 2026-11-05): alignment with directive §14

The directive's §14 metric list was checked against M1–M14 above. Five §14 metrics were missing and are added below. All targets are *proposed, not outcomes*, and the PO must confirm them.

| ID | §14 metric | Method | Timing | Proposed target |
|---|---|---|---|---|
| M15 | Weekly active users (seniors and family separately) | System logs: any user-initiated action in the ISO week, aggregated | Weekly | Report only |
| M16 | Check-in completion | Check-ins started vs. completed (incl. "prefer not to answer"), per senior per week | Weekly | Report only. No streak or nudging target (autonomy) |
| M17 | Family care actions triggered by authorised alerts | Count of acknowledgements, calls started from an alert, and replies, per authorised alert | Continuous | Report median per alert |
| M18 | False positives and missed scam signals (product accuracy) | Participant flag "this warning was wrong / this scam was missed" + researcher review of shared checks; plus the held-out eval set in `packages/ai/evals` | Continuous, day 30 | Report rates with 95% CI; no target before baseline |
| M19 | Privacy or consent-related complaints | Complaint log (in-app "report a concern" + facilitator log), categorised | Continuous | Every complaint reviewed within 48 h |

The Accessibility task completion in §14 is covered by M3. The "Scam scenario recognition before/after" is covered by M1/M2. Satisfaction and perceived autonomy are covered by M4/M12 (add a 5-point overall satisfaction item to the exit survey). Willingness to pay is covered by M13.
