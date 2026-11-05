# FGAI-2026-001 — UX Design Specification (v0.1)

Status: **DRAFT — awaiting DESIGN gate (UX + Product Owner).** Wireframes will be built as working, clickable screens in INC-1. This spec sets the rules those screens must follow.

## 1. Principles
1. **One screen, one decision.** The senior home has at most 6 tiles, and there are no hamburger menus for seniors.
2. **Calm by default.** Routine emotions use neutral and warm tones. Red is reserved for active scam/transfer warnings and the emergency button.
3. **Say only what is true.** Status text describes what the system did, never what an outside party did.
4. **The senior is the owner.** Every sharing control lives on the senior's side, and "only me" is always available.
5. **Thai-first plain language**, short sentences, polite particles (ค่ะ/ครับ chosen by the user's preference), no jargon ("ลิงก์" is fine, "phishing" is not).

## 2. Accessibility baseline (WCAG 2.2 AA)
- Base font 20px for the senior UI (18px for family). Supports 200% zoom without horizontal scroll. Respects OS text size.
- Touch targets ≥ 56×56 px for seniors (beyond the 24px minimum in 2.5.8).
- Contrast ≥ 4.5:1 for text and ≥ 3:1 for UI parts. Colour is never the only signal (icon plus text label).
- Full keyboard path, visible focus ring, skip link, `aria-live` for status changes, labelled form controls, errors linked by `aria-describedby`.
- No timed interactions. Undo for 10 s instead of confirmation dialogs where safe (e.g. a check-in), with explicit confirmation for revoke-all and delete.
- Optional voice: P1 uses the browser SpeechSynthesis "read aloud" button. No voice analysis.
- Fonts: Noto Sans Thai / Sarabun (loose line height 1.6 for Thai vowels and tone marks).

## 3. Design tokens (initial)
| Token | Light | Use |
|---|---|---|
| `--bg` | #FBF8F3 warm off-white | page |
| `--ink` | #1F2A2E | text |
| `--brand` | #2F6F6A deep teal | primary actions, trust |
| `--warm` | #E9A23B amber | check-in, gentle attention ("Check In Recommended") |
| `--alert` | #B3261E | scam high-risk, emergency only |
| `--ok` | #2E7D4F | "No Action Needed" |
Dark-mode equivalents are defined in INC-1.

## 4. Screen inventory (directive §5) with key content rules

| # | Screen | Primary user | Must include | Must avoid |
|---|---|---|---|---|
| 1 | Welcome & language | all | ไทย / English big toggle, brand promise | Sign-up walls before the language choice |
| 2 | Registration & verification | all | Plain password rules, demo-mode banner | Asking for ID card or bank details |
| 3 | Senior onboarding | senior | 3 steps: who you are → add one trusted person → sharing explained with examples | Pre-ticked sharing boxes |
| 4 | Family invite & consent | senior → family | Code shown to the senior to share verbally; consent summary in plain Thai | Auto-granting categories |
| 5 | Senior home | senior | Tiles: เช็กอินวันนี้ · โทรหาครอบครัว · ตรวจข้อความน่าสงสัย · ยา/นัดหมาย · ขอความช่วยเหลือ · ฉุกเฉิน (distinct, always bottom-fixed) | Badges/counters that create anxiety |
| 6 | Daily check-in | senior | 6 options with icon+word; "ไม่อยากตอบ" equal weight; sharing chooser | "Your mood score dropped" language |
| 7 | Reminders (P1) | senior/caregiver | "Taken / Skip / Remind later" | Medical advice |
| 8 | Suspicious-message checker | senior | Paste box, result card: category + "why" with quoted evidence + "what we're not sure about" + steps + Ask family / Call 1441 | The word "ปลอดภัย" (safe) as a verdict |
| 9 | Guardian Pause | senior | Amount, 4 yes/no questions, result, 4 actions | Implying the transfer was blocked |
| 10 | Emergency & assistance | senior | 1669, 191, 1441 with purpose, verification date, "แอปไม่ได้แจ้งหน่วยงานให้อัตโนมัติ" (the app does not notify agencies) | Fake progress/case numbers |
| 11 | Family dashboard | family | Card per senior: label chip + last update time + shared items only | Missing data shown as red / "decline" |
| 12 | Care alert detail | family/caregiver | What happened, when, who else was told, Acknowledge, Call | Extra personal detail beyond the grant |
| 13 | Notification centre | all | States: queued/sent/failed/seen/acknowledged | Hidden failures |
| 14 | Subscription (P1) | payer | "SANDBOX — no real charge" banner, plan comparison, history | Dark patterns, hard-to-find cancel |
| 15 | Privacy & permissions | senior | Member × category matrix, expiry, revoke, "who viewed" | Guilt-laden copy ("your family will worry") |
| 16 | Admin (P1) | admin | Health, queues, directory editor, audit | Any personal content |

## 5. Approved status vocabulary (single source in `packages/shared/labels.ts`)
Dashboard: **No Action Needed / ไม่ต้องดำเนินการ** · **Check In Recommended / ลองทักทายดูนะ** · **Assistance Requested / ขอความช่วยเหลือ** · **Verify Possible Scam / ช่วยตรวจสอบข้อความ**.
Actions: "เริ่มโทรจากแอป" (call started from app) · "ส่งการแจ้งเตือนถึง [ชื่อ] แล้ว" (alert sent to [name]) · "[ชื่อ] รับทราบแล้ว" ([name] acknowledged) · "ส่งไม่สำเร็จ — กำลังลองใหม่" (sending failed, retrying).
"Check In Recommended" triggers **only** from explicit signals (e.g. a self-reported "Lonely" or "Worried" that the senior shared), never from missing data alone.
Forbidden (enforced by test): ปลอดภัยแน่นอน, แจ้งตำรวจแล้ว, เลขคดี, รถพยาบาลกำลังไป, ซึมเศร้า, "definitely safe", "reported to police", "case number", "diagnosed".

Thai copy is a draft and needs native-speaker and older-adult review (assumption A9).
