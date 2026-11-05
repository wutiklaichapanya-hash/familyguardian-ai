DRAFT — evidence vs hypothesis labelled; requires Product Owner review

# 03 — How Might We, SCAMPER and Idea Selection

> All ideas and scores here are **[Hypothesis]/[Estimate]**: team judgement, not user data. Scores should be redone with real participants after discovery interviews.

## 1. How Might We (HMW)

Each HMW comes from a pain or root cause in `01_*` or `02_*`.

| # | How might we… (EN) | ทำอย่างไรเราจึงจะ… (TH, draft) | Source pain |
|---|---|---|---|
| HMW-1 | …give a senior a trustworthy second opinion on a suspicious message in under a minute, without needing to call anyone? | …ช่วยให้ผู้สูงอายุได้ความเห็นที่สองที่เชื่อถือได้เกี่ยวกับข้อความน่าสงสัยภายในหนึ่งนาที โดยไม่ต้องโทรหาใคร | No one to ask in the moment |
| HMW-2 | …break the "secrecy + urgency" spell just before money leaves the account? | …ทำลายแรงกดดัน "ห้ามบอกใคร + ต้องรีบ" ก่อนที่เงินจะถูกโอนออกไป | Root cause, fishbone |
| HMW-3 | …make asking for help feel smart instead of embarrassing? | …ทำให้การขอความช่วยเหลือรู้สึกว่า "ฉลาด" ไม่ใช่ "น่าอาย" | Shame / "ไม่อยากเป็นภาระ" |
| HMW-4 | …let families know *when* to reach out without seeing *everything*? | …ให้ครอบครัวรู้ว่า "ควรติดต่อเมื่อไร" โดยไม่ต้องเห็น "ทุกอย่าง" | Nok's tension |
| HMW-5 | …keep the senior clearly in charge of their own information, even under family pressure? | …ให้ผู้สูงอายุเป็นเจ้าของข้อมูลของตัวเองอย่างชัดเจน แม้ถูกครอบครัวกดดัน | Anti-persona, T1 |
| HMW-6 | …lower the effort of a small daily "I'm okay" so that it never feels like a test? | …ทำให้การบอก "วันนี้สบายดี" ง่ายจนไม่รู้สึกว่าถูกทดสอบ | Check-in burden |
| HMW-7 | …make sure seniors only ever call the *real* help numbers? | …ทำให้ผู้สูงอายุโทรหาเบอร์ช่วยเหลือ "ตัวจริง" เท่านั้น | Spoofed numbers, T3 |
| HMW-8 | …give caregivers clear tasks without exposing the senior's finances? | …ให้ผู้ดูแลรู้งานที่ต้องทำชัดเจน โดยไม่เห็นเรื่องการเงินของผู้สูงอายุ | Pim's boundaries |
| HMW-9 | …be honest about what the app does *not* know or do? | …บอกอย่างตรงไปตรงมาว่าแอป "ไม่รู้" หรือ "ไม่ได้ทำ" อะไร | False reassurance, T4/T5 |

## 2. SCAMPER

The baseline being transformed is **"family group chat + phone call"**, which is what Thai families most likely use today [Hypothesis].

| Lens | Question | Idea | Keep? | Why / why not |
|---|---|---|---|---|
| **S**ubstitute | What can replace "forward a screenshot to the family group and wait"? | ScamShield: paste the text and get reasons in seconds, then share with one tap if you choose | ✅ P0 | Directly answers HMW-1 |
| **C**ombine | Can we combine the scam check with reaching family? | The result card has built-in "Ask family" and "Call 1441" buttons | ✅ P0 | Removes a step at the decisive moment |
| **C**ombine | Combine check-in with reminders? | A single morning card with the check-in and today's medicines | ⏸ P1 | Mixes health data into the check-in; needs consent design |
| **A**dapt | What works elsewhere? | A "cooling-off" pause adapted from consumer-protection practice → Guardian Pause questions | ✅ P0 | HMW-2; no bank integration needed |
| **A**dapt | Adapt "read receipts"? | Visible acknowledgement ("Nok รับทราบแล้ว") so siblings know someone responded | ✅ P0 | HMW-4, fewer duplicate calls |
| **M**odify / Magnify | Make the important things bigger? | 6 big tiles; a distinct, always-visible emergency tile | ✅ P0 | Accessibility |
| **M**inify | What can we shrink? | The dashboard shows only 4 labels, not raw data; minimal notification bodies | ✅ P0 | Less surveillance, less fatigue |
| **P**ut to other use | Can the scam check teach? | Each result explains the tactic ("urgency", "impersonation"), so it builds skill over time | ✅ P0 (passive) | HMW-3; supports the pilot outcome on recognition |
| **P**ut to other use | Use check-ins to infer mental health? | — | ❌ Rejected | Diagnosis risk, emotional-certainty claim, coercion risk |
| **E**liminate | What can be removed? | No location, no passwords, no bank credentials, no "safe" verdict, no streaks | ✅ P0 | HMW-5, HMW-9 |
| **E**liminate | Remove sign-up for family? | — | ❌ | Weakens invite verification (T2) |
| **R**everse / Rearrange | Reverse who controls? | The *senior* invites and grants; family members ask, the senior decides | ✅ P0 | Core to the brand promise |
| **R**everse | Reverse the alert direction? | The senior sees "who viewed my info" | ✅ P0 | Transparency, T1 |
| **R**earrange | Automatic alert to family when a scam is detected? | — | ❌ (default off) | It would share without a per-event choice. Sharing a scam check stays the senior's choice; reconsider as an opt-in setting in P1 |

## 3. Idea selection

### 3.1 Candidate ideas
| ID | Idea |
|---|---|
| I-1 | ScamShield (rules engine, explainable) |
| I-2 | Guardian Pause (4-question pre-transfer pause) |
| I-3 | Voluntary self-report check-in with per-check-in sharing |
| I-4 | Granular consent grants with expiry plus "who viewed" |
| I-5 | Request Help with honest delivery and acknowledgement states |
| I-6 | Medication reminders and caregiver tasks |
| I-7 | LLM explainer for ScamShield |
| I-8 | Automatic mood inference from voice or text |
| I-9 | Live bank-transaction interception |
| I-10 | Location sharing |

### 3.2 Criteria and weights [Estimate: team judgement, PO to adjust]
| Criterion | Weight | Meaning (score 1–5) |
|---|---|---|
| User value (HMW coverage) | 25% | How strongly it addresses validated or likely pains |
| Safety and ethics | 25% | 5 = low risk of harm, coercion or false reassurance |
| Privacy (data minimisation) | 15% | 5 = little or no sensitive data |
| Feasibility for the MVP | 15% | 5 = buildable now without partners |
| Brand fit ("Protect Without Controlling") | 10% | 5 = strengthens autonomy |
| Testability in the pilot | 10% | 5 = clear measurable outcome |

### 3.3 Matrix
| Idea | Value | Safety | Privacy | Feasible | Brand | Testable | **Weighted** | Decision |
|---|---|---|---|---|---|---|---|---|
| I-2 Guardian Pause | 5 | 4 | 5 | 5 | 5 | 4 | **4.65** | P0 |
| I-1 ScamShield | 5 | 4 | 4 | 5 | 5 | 5 | **4.60** | P0 |
| I-4 Consent grants | 4 | 5 | 5 | 4 | 5 | 4 | **4.50** | P0 |
| I-5 Request Help | 4 | 4 | 4 | 4 | 4 | 4 | **4.00** | P0 |
| I-3 Check-in | 4 | 3 | 2 | 5 | 4 | 4 | **3.60** | P0, with healthcare safety rules (`08_*`) |
| I-6 Reminders/tasks | 3 | 3 | 2 | 4 | 4 | 3 | **3.10** | P1 |
| I-7 LLM explainer | 3 | 3 | 3 | 3 | 4 | 3 | **3.10** | P1, flag off (B2) |
| I-9 Bank interception | 5 | 2 | 1 | 1 | 2 | 2 | **2.45** | Excluded; P2 only via a bank partner |
| I-10 Location | 3 | 1 | 1 | 4 | 1 | 3 | **2.15** | Rejected |
| I-8 Mood inference | 2 | 1 | 1 | 2 | 1 | 2 | **1.50** | Rejected (prohibited) |

Weighted = Σ(score × weight). Example for I-1: 5×.25 + 4×.25 + 4×.15 + 5×.15 + 5×.10 + 5×.10 = 4.60.

### 3.4 Rationale
1. **I-2 and I-1 lead** because they target the root cause from the fishbone (secrecy plus urgency at the decisive moment), need no partners, and their effect can be measured (the recognition test in `06_*`).
2. **I-4 is the foundation.** Without trustworthy consent, every other feature risks becoming surveillance. It scores highest on safety and privacy.
3. **I-3 is kept despite a lower privacy score** because loneliness is half of the problem statement. It is kept only under strict rules: self-report only, skipping is neutral, no scoring, and a per-check-in sharing choice.
4. **I-8 and I-10 are rejected** on safety, ethics and brand grounds, even though families might ask for them. The project accepts this market trade-off on purpose. [Hypothesis: some families will want location; the pilot exit survey should ask.]
5. **Sensitivity check:** if Feasibility is weighted at 30% (taking 15 points from Value), the top three stay the same. The ranking is robust to that change.
