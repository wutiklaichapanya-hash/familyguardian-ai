DRAFT — evidence vs hypothesis labelled; requires Product Owner review

# 08 — Healthcare Safety Review (copy and behaviour rules)

| Field | Value |
|---|---|
| Reviewer role | Healthcare Safety (FG-HS), documents only. Backlog item HS-1 covers the code-level copy review later |
| Reviewed | `docs/product/04_UX_SPEC.md` (v0.1), `docs/product/01_DISCOVERY_AND_SCOPE.md` (v0.1). For context only, also `packages/shared/src/labels.ts`, `services/api/src/notifications/copy.ts` and `apps/web/lib/visual.ts` as they stood on 2026-11-05 |
| Question | Does any copy or behaviour rule **imply diagnosis, emotional certainty or clinical claims**, or create false reassurance about health or safety? |
| Not in scope | Clinical validation (there is nothing clinical to validate); legal determinations (see `07_*` §10) |

Severity: **High** = could mislead someone about health or safety in a way that could delay help, or could push the product towards medical-device territory. **Medium** = could be misread; fix before UAT. **Low** = wording polish.

---

## 1. Summary

The specs are **already strongly protective**: no "safe" verdict; no emotion inference; missing data is never shown as decline; honest action vocabulary; a forbidden-phrase test that already includes ซึมเศร้า, วินิจฉัย, "depression" and "diagnosed". I found **no explicit diagnostic claim**. The issues below are mostly **implied** meanings and **gaps**, where a rule is missing rather than wrong.

| ID | Severity | Issue (short) |
|---|---|---|
| HS-01 | Medium | The name "FeelSense" implies the app senses feelings |
| HS-02 | **High** | No static, unconditional crisis or medical help line on the check-in or note screen |
| HS-03 | **High** | "No Action Needed" (✓, green) can read as "she is fine" |
| HS-04 | Medium | "Trend" view can imply mood monitoring or a trajectory |
| HS-05 | Medium | "Tired" is ambiguous between emotional and physical |
| HS-06 | Medium | P1 reminders: a "missed reminder" signal could become adherence monitoring |
| HS-07 | Medium | No rule on how the app responds to a check-in (risk of evaluative or emotional-certainty feedback) |
| HS-08 | Medium | Free-text notes: the app must never imply it reads or understands them |
| HS-09 | Low | The forbidden-phrase list is missing some clinical and certainty terms |
| HS-10 | Low | "Guardian" / "Protect" / "AI" brand words can imply guaranteed protection |
| HS-11 | Low | "Check In Recommended" might be read by families as a clinical alert |
| HS-12 | Low | Emergency fallback text names only 1669 |

---

## 2. Issues and recommended fixes

### HS-01: "FeelSense" name (Medium)
- **Where:** scope §3.1 INC-1 ("daily FeelSense check-in").
- **Problem:** "Sense" suggests the system *detects* or *senses* feelings, which is an emotional-certainty and inference connotation that the product explicitly rejects. It could also support a reading of intended medical purpose (`07_*` §10).
- **Fix:** use a user-facing name that describes self-report, e.g. **"เช็กอินวันนี้" / "Today's check-in"** (already the home-tile text). If "FeelSense" stays as an internal codename, it must never appear in UI or marketing.

### HS-02: No unconditional help line on the check-in (High)
- **Where:** UX §4 screen 6 (daily check-in). The scope only adds "call 1669 if urgent" after an unacknowledged help request (S-07).
- **Problem:** a senior may record "Worried" or type a distressing note expecting someone to notice. Nobody reads notes (by design), so the app must make help-seeking visible **without** conditional logic that would imply detection.
- **Fix (behaviour rule):** show a **static, identical footer on every check-in screen, whatever the answer**: "หากรู้สึกไม่สบาย หรือเป็นเหตุฉุกเฉิน โทร 1669 · อยากคุยกับใครสักคน กด 'โทรหาครอบครัว'" ("If you feel unwell or it's an emergency, call 1669 · Want to talk to someone? Tap 'Call family'"). Consider adding the Department of Mental Health line **1323** only after human verification of the number and hours (B4). **Do not** show this footer *because* of an answer: conditional display would imply the app assessed the person. (Recorded as PRD FR-A4.)

### HS-03: "No Action Needed" can read as "she is fine" (High)
- **Where:** UX §5 approved vocabulary; `visual.ts` renders it with a ✓ icon and an `ok` (green) tone.
- **Problem:** the label is derived **only** from what the senior chose to share. With nothing shared, or a "Prefer not to answer", the family sees a green tick that looks like a well-being verdict. This is false reassurance (DPIA RI-2), the health counterpart of the banned "safe" verdict.
- **Fixes:**
  1. Add a mandatory sub-line under the chip: **"จากข้อมูลที่ [ชื่อ] แชร์ไว้เท่านั้น" / "Based only on what [name] shared"** (PRD FR-H2).
  2. Change the icon from ✓ to a neutral symbol (e.g. "–" or an information icon) and the tone from `ok` to `neutral`. The `--ok` green in UX §3 should not mean "healthy".
  3. In onboarding, tell families: "แอปนี้ไม่ได้ประเมินสุขภาพ" (this app does not assess health).

### HS-04: The "trend" view (Medium)
- **Where:** scope S-03 ("See my own trend"); INC-1 "personal trend view".
- **Problem:** "trend" suggests a direction (improving or declining), which invites mood-trajectory interpretation and a monitoring purpose. The current implementation (`apps/web/lib/trend.ts`) is a 14-day **calendar of entries with explicit gaps**, which is good. The *word* is the risk.
- **Fix:** user-facing label **"ประวัติการเช็กอินของฉัน" / "My check-in history"**. Rules: no line or slope chart; no averages or scores; no "better/worse than last week"; no colour scale from good to bad moods. Show entries as a calendar or list exactly as entered.

### HS-05: "Tired / เหนื่อย" is ambiguous (Medium)
- **Problem:** "Tired" may be emotional or physical (a possible symptom). The app must not treat it as a symptom, and must not escalate it as one.
- **Fix:** keep the option (it is a natural self-report), but: (a) it must **not** trigger "Check In Recommended" (consistent with UX §5, which lists only Lonely and Worried; make this explicit in the rules); (b) no health advice appears after it; (c) the static footer from HS-02 covers the "feel unwell" case.

### HS-06: P1 reminders and "missed reminder" signals (Medium)
- **Where:** UX §4 screen 7 ("Taken / Skip / Remind later", must avoid "Medical advice"); architecture §4 lists "missed reminder [P1]" as a notification signal.
- **Problem:** telling family that a medicine was "missed" turns a personal reminder into **medication-adherence monitoring**, which is closer to a clinical function and a control risk (T1).
- **Fixes:** a "missed reminder" signal is **off by default** and goes only to grantees the senior chose for `care_tasks`. The wording describes the action, not the health meaning: "ยังไม่ได้กด 'ทานแล้ว' สำหรับการเตือน 08:00" ("'Taken' hasn't been tapped for the 08:00 reminder"), never "ไม่ได้ทานยา" (did not take medicine) or "ไม่ปฏิบัติตามการรักษา" (non-adherent). No dosage, timing or interaction advice. A reminder is a user-entered note, never a prescription. "Skip" must never be styled as a failure.

### HS-07: Response after a check-in (Medium)
- **Problem:** the spec doesn't define the confirmation copy. Typical patterns ("Great job!", "We're sorry you feel sad", "You seem lonely this week") are evaluative or claim emotional understanding.
- **Rule:** a neutral confirmation only: "บันทึกแล้ว · แชร์กับ: [names] / เฉพาะฉัน" ("Saved · Shared with: [names] / Only me"). No praise, pity or interpretation, and no "we noticed…". The 10-second undo stays.

### HS-08: Free-text notes (Medium)
- **Problem:** seniors may assume that writing "I fell" or "I don't want to live" in a note will reach someone. It won't, unless the note is shared, and even then nobody is obliged to read it promptly.
- **Rules:** placeholder text under the note box: "บันทึกนี้ไม่มีใครอ่านอัตโนมัติ หากต้องการความช่วยเหลือ กด 'ขอความช่วยเหลือ'" ("Nobody reads this note automatically. If you need help, tap 'Request Help'"). No NLP or keyword scanning of notes, which would be inference and would create a false expectation of monitoring.

### HS-09: Forbidden-phrase additions (Low)
The current list (`labels.ts`) is a good base. Proposed additions for the test, with **context review** for words that have harmless uses:

| Add (block outright) | Add (flag for human review in context) |
|---|---|
| "mood score", "คะแนนอารมณ์", "mental health score", "ตรวจพบ", "detected" (with a mood or health object), "อาการ", "symptom", "abnormal", "ผิดปกติ", "at risk of", "เสี่ยงต่อภาวะ", "ภาวะ", "anxiety disorder", "โรค", "treatment", "การรักษา", "monitoring your health", "ติดตามสุขภาพ", "we noticed you seem", "คุณดูเหมือน" | "ปกติ" / "normal", "healthy" / "สุขภาพดี", "wellness", "safe" in non-scam contexts, "guardian" in claims |

### HS-10: Brand words (Low)
"FamilyGuardian AI", "Protect" and "Guardian Pause" can suggest guaranteed protection, and "AI" suggests intelligence the rules engine doesn't have. **Rule:** every marketing surface carries a plain limitation line, e.g. "ช่วยให้หยุดคิดและตรวจสอบ ไม่ได้รับประกันความปลอดภัย" ("Helps you pause and check; it does not guarantee safety"). Never claim "prevents scams" or "keeps elders safe".

### HS-11: "Check In Recommended" as a clinical alert (Low)
The Thai "ลองทักทายดูนะ" and the notification copy "อาจอยากให้ทักทาย" ("may welcome a check-in") are appropriately soft. **Keep.** Make sure the alert detail screen shows **only** "[ชื่อ] แชร์ว่ารู้สึก 'เหงา'" ("[name] shared that she feels 'lonely'"), quoting the self-report, with no added interpretation, and is not styled in red.

### HS-12: Emergency fallback names only 1669 (Low)
S-07's fallback "call 1669 if urgent" is right for medical emergencies. Add "191" for danger from a person, and keep the 1441 path for scams. All numbers come from the verified directory with `needs_human_verification` until checked (B4).

---

## 3. Rules to keep (do not weaken)

| # | Rule | Source |
|---|---|---|
| K-1 | No emotion inference from voice, behaviour or text; no depression screening; no diagnosis | Scope §3.2 |
| K-2 | "ไม่อยากตอบ" has equal weight with the other options | UX §4 #6 |
| K-3 | Missing check-ins show neutrally ("ยังไม่มีการเช็กอินวันนี้") and never trigger alerts or decline wording | Scope S-03, F-02; UX §5 |
| K-4 | "Check In Recommended" only from an explicit, shared self-report (Lonely or Worried) | UX §5 |
| K-5 | No "your mood score dropped" language | UX §4 #6 |
| K-6 | Red only for active scam or transfer warnings and the emergency button, never for feelings | UX §1.2 |
| K-7 | The status vocabulary describes only what the system did; no claim that an agency or ambulance was notified | UX §1.3, §5; T5 |
| K-8 | No medical advice in reminders | UX §4 #7 |
| K-9 | Voice is read-aloud only; no voice analysis | UX §2 |
| K-10 | Minimal notification bodies (no mood on the lock screen) | T7; `copy.ts` |
| K-11 | Forbidden-phrase test enforced in CI | UX §5; backlog HS-1 |
| K-12 | Per-check-in sharing choice, with "only me" always available | UX §1.4; S-02 |
| K-13 | No streaks, badges or counters that create anxiety | UX §4 #5 |

## 4. Handover
- HS-02, HS-03 and HS-04 should be fixed **before the DESIGN gate**; the rest before UAT.
- These recommendations belong to the UX & Accessibility owner (`04_UX_SPEC.md`) and the Frontend owner (`apps/web`). This reviewer does not edit those files. PRD FR-A4 and FR-H2 reflect HS-02 and HS-03.
- Re-review is required whenever a new check-in option, label, reminder signal or health-related integration is proposed.
