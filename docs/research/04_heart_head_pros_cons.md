DRAFT — evidence vs hypothesis labelled; requires Product Owner review

# 04 — Heart/Head Canvas and Pros/Cons Canvas

> Content is **[Hypothesis]** unless marked otherwise. The canvases look at the overall concept, "FamilyGuardian: a consent-first safety and connection app for older adults and their families", and then at the three most debated design choices.

## 1. Heart / Head canvas

The *Heart* side covers emotional drivers and fears (why people would or would not care). The *Head* side covers rational evidence, logic and constraints (whether it makes sense and can work).

| | **Heart: emotional** | **Head: rational** |
|---|---|---|
| **Senior (Somsri)** | Wants to feel capable and not a burden; fears being tricked and shamed; loves hearing from family; dislikes being watched | Needs to know which number is real; wants big text and few steps; can see that a 30-second check is cheaper than a loss |
| **Family (Nok)** | Guilt about distance; fear of "finding out too late"; wants to be a good child without nagging | Can't monitor all day; group chat is noisy; needs a clear signal of *when* to act; considers price against peace of mind |
| **Caregiver (Pim)** | Wants to be trusted and recognised; fears blame | Needs a task list and a record; clear boundaries on finances |
| **Society / partners** | Public concern about scams; respect for elders (กตัญญู) | [Evidence] As reported by The Star (citing GASA), about 110 billion baht was lost to scams in the past year: https://www.thestar.com.my/aseanplus/aseanplus-news/2025/11/12/us339bil-lost-to-scams-in-thailand-in-past-year-six-in-10-fall-victim-to-fraudsters. [Evidence] As reported by Nation Thailand (NSO), 19.5% of Thais were 60+ in 2023: https://nationthailand.com/thailand/policies/40037391 |
| **What wins hearts** | "You stay in charge." "Checking is smart, not silly." Visible acknowledgement ("Nok รับทราบแล้ว") | — |
| **What convinces heads** | — | Honest outputs (no "safe", no fake reports); a measured scam-recognition improvement in the pilot (not yet measured); clear PDPA posture; works without AI |
| **What could lose hearts** | Feeling tested or spied on; a scolding tone after a near-miss; red alarms over ordinary feelings | — |
| **What could lose heads** | — | Feature gaps ("can't block transfers", "no location"); unclear value next to free tools (LINE, Whoscall); subscription price |

**Synthesis.** The *heart* message is dignity and connection. The *head* message is that the product gives an honest second opinion at the decisive moment. We must not trade the heart message for head features (location, auto-alerts), because doing so breaks "Protect Without Controlling".

## 2. Pros / Cons canvas

### 2.1 Concept level
| Pros | Cons |
|---|---|
| Targets the decisive moment (urgency plus secrecy) rather than after-the-fact reporting | Can't stop a transfer; it relies on the senior choosing to pause |
| Consent-first design differentiates it from tracking apps and lowers coercion risk | Families who want control may prefer tracking apps (possible market loss) |
| Works offline and without AI, so it is deterministic and testable | The rules engine can miss novel scams and will produce false positives |
| Thai-first and accessible | Thai copy quality depends on native-speaker and older-adult review (A9) |
| Low partner dependency for the MVP | Real impact (bank or AOC integration) needs partners later |
| Brand promise is clear and ethical | Harder to explain than "we watch your parents" |

### 2.2 Design choice: no "safe" verdict in ScamShield
| Pros | Cons | Decision |
|---|---|---|
| Prevents false reassurance (T4); honest about uncertainty | Users may find "still verify" frustrating or vague | **Keep.** Test comprehension of `low_signals` wording in UAT |

### 2.3 Design choice: missing check-in is never an alert
| Pros | Cons | Decision |
|---|---|---|
| No pressure, no surveillance; skipping is a choice | A real problem day with no check-in goes unnoticed by the app | **Keep.** The app is explicitly *not* a safety monitor. Say so in onboarding: "แอปนี้ไม่ได้เฝ้าดูตลอดเวลา" (this app does not watch you all the time) |

### 2.4 Design choice: the senior chooses sharing per event, with no automatic family alert on high-risk scams
| Pros | Cons | Decision |
|---|---|---|
| Autonomy; avoids shaming; the senior controls the story | A senior under pressure might not share, so the family misses a chance to step in | **Keep for P0.** Explore an *opt-in, senior-configured* "always share high-risk checks with Nok" in P1, with the PO and Healthcare/Safety review |

### 2.5 Design choice: caregivers can never see scam checks or transfer pauses
| Pros | Cons | Decision |
|---|---|---|
| Protects against financial exploitation by paid carers; protects carers from suspicion | A trusted live-in carer may be the best person to help | **Keep.** Revisit only with evidence and an explicit senior-initiated exception |
