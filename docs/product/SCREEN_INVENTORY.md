# Screen inventory — apps/web (INC-1…INC-4 build, contract v0.2)

Spec screen numbers refer to `docs/product/04_UX_SPEC.md` §4. Status values:
- **Built**: implemented and compiled. API calls were smoke-tested through the Next proxy where noted.
- **Built (P1 stub)**: an honest placeholder.
- **Not built**: no screen yet.

| Route | Spec # | Screen | Roles | Status | Notes |
|---|---|---|---|---|---|
| `/` | 1 | Welcome & language | all, public | Built | Big ไทย/English toggle, brand promise, demo banner, links to sign in and /emergency |
| `/login` | 2 (partial) | Sign in | public | Built | 5 demo one-tap fill buttons (hidden when `NEXT_PUBLIC_DEMO_MODE=false`); no registration screen yet |
| — | 2 | Registration & verification | all | Not built | No register endpoint in contract v0.2 |
| — | 3 | Senior onboarding (3 steps) | senior | Not built | Covered in part by /privacy invite + sharing explanations |
| `/privacy` (invite section) | 4 | Family invite & consent | senior | Built | Invite **link** shown once (no spoken code, SR-08/09); pending-confirmation list with password step-up confirm; cancel invite |
| `/invite/accept` | 4 | Accept invitation | family/caregiver | Built | Token from `#token=` (or `?token=`), stripped from URL, sent in body; shows "waiting for [senior] to confirm" |
| `/home` | 5 | Senior home | senior | Built | 5 tiles + 6th (ยา/นัดหมาย "เร็วๆ นี้" placeholder); emergency button sticky at the bottom; no badges/counters |
| `/checkin` | 6 | Daily check-in + my history | senior | Built (smoke-tested) | 6 equal moods, note, share-note, only-me, neutral confirmation, static help footer (HS-02), 14-day list with "ไม่มีข้อมูล" gaps |
| — | 7 | Reminders (P1) | senior/caregiver | Not built | Home tile shows "เร็วๆ นี้" |
| `/scam-check` | 8 | Suspicious-message checker | senior | Built (smoke-tested) | RISK_LABELS chip, defanged evidence quotes, uncertainty, steps, share with `scam_checks` grantees, tel:1441 |
| `/guardian-pause` | 9 | Guardian Pause | senior | Built | Amount + 4 yes/no, stop/care result, stop-and-verify steps, call someone you trust, bank (verified only, else honest note), 1441, share; persistent "not linked to your bank" note |
| `/contacts` | (5→A) | Call trusted contact | senior | Built | `tel:` link + POST /me/call-logs, "เริ่มโทรจากแอป"; add/remove contacts |
| `/help` | (5→I) | Request help + delivery states | senior | Built (API smoke-tested) | Polls every 5 s; simulated channels labelled; noRecipients state; "ยังไม่มีใครรับทราบ — ถ้าเร่งด่วนโทร 1669" |
| `/emergency` | 10 | Emergency & assistance | all, **public** | Built | Directory from API when signed in, static fallback (1669/191/1441/1300) otherwise; "รอการยืนยันข้อมูล" badge; "แอปไม่ได้แจ้งหน่วยงานให้อัตโนมัติ"; 1300 coercion line |
| `/family` | 11 | Family dashboard | family/caregiver | Built (API smoke-tested for nok + anan) | Card per senior, neutral status chip + "จากข้อมูลที่แชร์กับคุณเท่านั้น", NO_DATA_LABEL, not_shared, amount buckets; signed-in devices |
| `/alerts/[id]` | 12 | Care alert detail | family/caregiver | Built | Origin labelled (user_requested vs system_warning), own delivery only, Acknowledge, call (only if the senior is in viewer's contacts) + 1669 |
| `/notifications` | 13 | Notification centre | family/caregiver/senior | Built | State chips, "จำลอง (ทดสอบ)" badge, `contentUnavailable` → "เนื้อหานี้ไม่สามารถแสดงได้แล้ว" |
| `/billing` | 14 | Subscription (P1) | payer | Built (P1 stub) | SANDBOX banner; shows plans if `/billing/plans` responds, else "ยังไม่เปิดใช้" |
| `/privacy` | 15 | Privacy & permissions | senior | Built | Member × category list with share/revoke (confirm dialog), expiry choice, caregiver-forbidden cells, step-up for sensitive grants and member removal, access log, periodic review note, signed-in devices, 1300 line |
| `/admin` | 16 | Admin overview (P1) | admin | Built | Counts only from GET /admin/overview; no directory editor yet |
