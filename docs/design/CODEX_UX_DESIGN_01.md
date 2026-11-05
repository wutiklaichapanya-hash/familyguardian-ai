# FamilyGuardian UI design proposal

**Review date:** 5 November 2026  
**Scope:** Read-only review of the requested UX, healthcare, security and approved-wording documents; all implemented routes; shared components; Thai/English catalogues; and application CSS. No files modified.

This is a source-code review, not a rendered-browser accessibility certification. References describe the code read during this review; another engineer’s ongoing edits may move line numbers.

**Recommendation:** Keep the warm teal foundation. Prioritise truthful help states, explicit sharing choices and accessible navigation before visual polish.

**Priorities:** **P0** before older-adult UAT; **P1** next implementation cycle; **P2** subsequent refinement.

## 1. Visual direction and final tokens

### Identity: familiar, composed, respectful

Use the visual language of a clearly organised family notebook: warm paper backgrounds, strong Thai lettering, named people and straightforward actions.

The existing palette, self-hosted Noto Sans Thai and restrained cards are appropriate (`app/globals.css:2–45`, `app/layout.tsx:7–13`). Refine these rather than introducing a new identity.

- Use teal for actions, warm amber for gentle attention, and red for active scam/transfer warnings and emergency actions.
- Replace platform-dependent emoji with a consistent set of simple SVG icons, always accompanied by words. Keep the existing equal treatment of all six check-in answers.
- Use one filled primary action per decision area; secondary actions have outlined borders.
- Keep “FamilyGuardian” as the name. Add the limitation line on welcome: **“ช่วยบันทึก ติดต่อ และตรวจสอบข้อมูล แอปนี้ไม่ใช่บริการฉุกเฉิน”**.
- Simplify the shield-and-heart mark in `app/icon.svg` and `public/icon.svg` to a modest house or connected-person symbol. The shield currently emphasises protection more than the app can substantiate.
- No gradients, glowing effects, chatbot avatars, animated reassurance or health-style green status dashboards.

### Final colour tokens

These largely retain the implementation. Add darker amber tokens for text and meaningful boundaries.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FBF8F3` | `#121816` | Page |
| `--surface` | `#FFFFFF` | `#1B2321` | Cards, inputs |
| `--surface-2` | `#F3EEE5` | `#232D2A` | Secondary panels |
| `--ink` | `#1F2A2E` | `#E8ECEA` | Main text |
| `--ink-muted` | `#47545A` | `#B5C0BD` | Supporting text |
| `--border` | `#7A8487` | `#87938F` | Controls, meaningful outlines |
| `--brand` | `#2F6F6A` | `#7CC4BC` | Primary fill, links |
| `--brand-ink` | `#FFFFFF` | `#0E1513` | Text on primary fill |
| `--brand-tint` | `#E1EFED` | `#1F3633` | Informational panels |
| `--warm` | `#E9A23B` | `#F0B860` | Decorative attention accent |
| `--warm-ink` | `#744800` | `#F0B860` | Attention/error text |
| `--warm-border` | `#9C6418` | `#F0B860` | Meaningful attention boundary |
| `--warm-tint` | `#FCEFD9` | `#3A2F1C` | Attention background |
| `--alert` | `#B3261E` | `#FF8A80` | Active warning/emergency |
| `--alert-ink` | `#FFFFFF` | `#1A0807` | Text on alert fill |
| `--alert-tint` | `#F9E3E1` | `#3D1D1B` | Active warning background |
| `--focus` | `#1A4FD6` | `#9AB8FF` | Keyboard focus |

Retire green from person-status and acknowledgement chips. Replace `.chip-ok` usage with neutral or informational styling; acknowledgement describes a button press, not resolution.

### Computed contrast

Calculated from the hex values using linearised sRGB relative luminance and `(Llighter + .05) / (Ldarker + .05)`, rounded to two decimals.

| Foreground / background | Light | Dark |
|---|---:|---:|
| Ink / page | 13.87:1 | 15.08:1 |
| Ink / surface | 14.70:1 | 13.46:1 |
| Ink / secondary surface | 12.72:1 | 11.90:1 |
| Muted / page | 7.39:1 | 9.62:1 |
| Muted / surface | 7.83:1 | 8.59:1 |
| Muted / secondary surface | 6.77:1 | 7.59:1 |
| Primary-button text / primary fill | 5.83:1 | 9.23:1 |
| Brand / brand tint | 4.93:1 | 6.41:1 |
| Alert-button text / alert fill | 6.54:1 | 8.50:1 |
| Alert / alert tint | 5.32:1 | 6.62:1 |
| Ink / warm tint | 12.94:1 | 10.99:1 |
| Warm ink / warm tint | 6.93:1 | 7.32:1 |
| Border / surface | 3.83:1 | 5.04:1 |
| Focus / surface | 6.70:1 | 8.15:1 |

All listed text combinations exceed 4.5:1. Use only these defined combinations for text.

The existing light amber `#E9A23B` against its tint is **1.91:1**. It is suitable as decoration, but use `--warm-border` for a boundary that must communicate state: **4.35:1** against the light warm tint.

### Typography, layout and interaction tokens

Use **Noto Sans Thai** throughout, retaining the current build-time font hosting. **Sarabun** is the Thai fallback; avoid mixing in Prompt for headings, which would add a second visual voice.

| Role | Senior size / line-height | Family size / line-height | Weight |
|---|---|---|---|
| Page title | 32px / 48px | 29px / 44px | 700 |
| Section title | 26px / 42px | 24px / 38px | 700 |
| Card title | 22px / 36px | 20px / 32px | 600 |
| Body, labels, buttons | 20px / 32px | 18px / 29px | 400 / 600 |
| Supporting text | 18px / 29px | 16px / 26px | 400 |

Implement in relative units, preserving the current percentage-based root size. Critical limitations, recipient names and help states remain body-sized.

| Token | Final value |
|---|---|
| Spacing | 4, 8, 12, 16, 24, 32, 48px; implement as rem equivalents |
| Page gutter | 16px mobile; 24px from tablet upward |
| Content width | Senior: maximum 36rem; family: 44rem |
| Card padding | 20px mobile; 24px larger screens |
| Radius | Input 10px; button 12px; card 16px; chips 999px |
| Elevation | Ordinary cards: none; modal light: `0 8px 24px rgb(31 42 46 / .14)`; dark: `0 8px 24px rgb(0 0 0 / .35)` |
| Senior targets | Minimum 56 × 56px; 12px between adjacent major actions |
| Focus | 3px outline, 3px surface-coloured gap; never clipped |
| Motion | No necessary animation; retain reduced-motion support |

## 2. Route-by-route critique

Paths below are relative to `apps/web/`.

| Route and evidence | What works | Concrete change | Priority |
|---|---|---|---|
| `/` — `app/page.tsx:13–40` | Language choice precedes authentication; emergency access is public. | Remove the duplicate in-content demo banner already supplied by AppShell. Replace the under-one-minute promise with unhurried wording. Add the plain limitation line. | P1 |
| `/login` — `app/login/page.tsx:58–105` | Persistent labels, password-manager autocomplete, linked errors and demo-account autofill. | Add show/hide password. Make emergency access a 56px action. Separate senior demo entry from staff accounts. Registration/recovery are absent: design these before real onboarding. | P1; onboarding gap before pilot |
| `/home` — `app/home/page.tsx:8–55` | Clear labelled tiles; no hamburger menu or anxiety counters. | Promote Guardian Pause from the small “other” link into the grid, replacing the unavailable medicine tile. Move the medicine roadmap notice below navigation. Make emergency access visible from initial load. | P0 |
| `/checkin` — `app/checkin/page.tsx:120–199` | Six equal radio choices; note warning; unconditional help footer; neutral history gaps. | Replace the inverse “only me” checkbox with an explicit audience choice. Default to private; show eligible recipients before saving. Handle recipient-load failure explicitly. Add a genuine correction/retraction path. | P0 |
| `/contacts` — `app/contacts/page.tsx:39–43, 99–147` | Large named call actions; relationship labels; delete confirmation. | Show the number inside the call area. Replace call-start claims with “requested opening the phone app.” Collapse contact creation beneath the call list. Fix first-invalid-field focus. | P0 wording; P1 layout |
| `/scam-check` — `app/scam-check/page.tsx:100–160` | Approved risk labels, evidence, uncertainty, next steps and explicit sharing; quotes are defanged. | Put the immediate action and uncertainty directly below the verdict. Move family assistance above long evidence. Label evidence numbers as originating in the message; never call them. Add URL length guidance/cap. | P0 |
| `/guardian-pause` — `app/guardian-pause/page.tsx:93–206` | Four unanswered-by-default questions; honest bank limitation; bank entries filtered to verified records. | Remove permission-to-transfer language from the lower-risk result. Display verification steps immediately rather than behind a toggle. Explain the data included when sharing. | P0 |
| `/help` — `app/help/page.tsx:28–48, 73–122` | Recipient delivery states, no-recipient handling and acknowledgement are visible. | Show intended recipients before sending. Surface initial-load and polling failures with last-checked time. Keep call alternatives available after acknowledgement. Distinguish request creation from delivery. | P0 |
| `/emergency` — `app/emergency/page.tsx:14–80` | Public fallback list; purposes, verification status and no-automatic-notification explanation. | Put number and purpose together in each call button. Explain “awaiting verification” as directory-data status. Show provenance/date when available. API absence is handled; first-visit offline loading is not established by this code. | P1 |
| `/privacy` — `app/privacy/page.tsx:177–360` | Per-person categories, expiry, revoke, identity confirmation and access log. | Keep the stacked matrix on mobile. Move expiry choice into the specific grant action. Isolate section failures: one failed request currently prevents all four datasets loading. Add a clearly explained stop-all-sharing flow. | P0 recovery; P1 organisation |
| `/invite/accept` — `app/invite/accept/page.tsx:10–16, 28–64, 85–110` | Token removed from address bar; explicit acceptance; waits for senior confirmation. | Show the signed-in account and a switch-account action. Keep a filled token out of the main decision area. Explain that confirmation and category sharing are separate steps. | P1 |
| `/family` — `app/family/page.tsx:22–116` | Neutral “No Action Needed”; shared-data limitation; timestamps; category gating; amount buckets. | Preserve these fixes. Put pending requests before optional shared history. Add explicit “latest shared check-in” wording for older entries and a manual refresh with freshness indicator. | P1 |
| `/alerts/[id]` — `app/alerts/[id]/page.tsx:67–120` | Origin, time, recipients and acknowledgement separated; phone comes from viewer’s contacts. | Change “who was notified” to “delivery status.” Explain acknowledgement as a recorded press. Defang untrusted text in summaries. Keep call feedback visible even after acknowledgement. | P0 |
| `/notifications` — `app/notifications/page.tsx:23–29, 43–69` | Simulation badges, unavailable-content state and distinct delivery chips. | Report mark-seen failure instead of swallowing it; announce successful changes. Senior-accessible alert links currently lead to a family/caregiver-only route: provide a senior destination. Add senior navigation access. | P0 |
| `/admin` — `app/admin/page.tsx:22–59, 68` | Operational counts only; generated timestamp. | Distinguish missing counts from zero. Remove `org_admin` from the frontend gate until supported. Keep directory editing out until the SR-17 approval/MFA prerequisites exist. | P1 |
| `/billing` — `app/billing/page.tsx:20–27, 63–90` | Prominent sandbox label; visible cancellation; no checkout redirect. | Subscription-load failure must not become “no plan.” Add busy states, an equivalent plan-comparison structure and history when supported. Replace raw checkout URL prose with a clear simulated-checkout result. | P1 |

### Proposed wireframes

Illustrative names, amounts and times below are fictional. Brackets indicate controls.

#### Senior home

```text
+------------------------------------------+
| FamilyGuardian          [ไทย] [English]  |
| สวัสดีค่ะ คุณสมศรี                        |
|                                          |
| [ เช็กอินวันนี้ ]  [ โทรหาครอบครัว ]       |
| [ ตรวจข้อความ  ]  [ ก่อนโอนเงิน   ]       |
| [ ขอความช่วยเหลือ                 ]       |
|                                          |
| [การแชร์ข้อมูล]  [การแจ้งเตือน]             |
| ยา/นัดหมาย: ยังไม่เปิดใช้                   |
|                                          |
+------------------------------------------+
| [ ฉุกเฉิน · 1669 / 191 / 1441 ]           |
+------------------------------------------+
```

Five working tiles plus the emergency action. At narrow widths or large text, use one column. Reserve space for the emergency dock.

#### Check-in

```text
+------------------------------------------+
| [กลับหน้าหลัก]                            |
| วันนี้เป็นอย่างไรบ้าง                      |
| เลือก 1 ข้อ                              |
|                                          |
| ( ) มีความสุข      ( ) ก็ดี                |
| ( ) เหงา           ( ) กังวล               |
| ( ) เหนื่อย        ( ) ไม่อยากตอบ          |
|                                          |
| อยากเล่าเพิ่มไหม (ไม่บังคับ)               |
| [                                      ] |
| ไม่มีใครอ่านข้อความนี้อัตโนมัติ             |
| [ขอความช่วยเหลือ]                         |
|                                          |
| ใครดูเช็กอินนี้ได้                         |
| (*) เฉพาะฉัน                             |
| ( ) แชร์ตามที่ตั้งไว้: นก, อนันต์           |
| [ ] แชร์ข้อความที่เขียนด้วย                |
|                                          |
| [ บันทึกเช็กอิน ]                         |
|                                          |
| ถ้าไม่สบายหรือเป็นเหตุฉุกเฉิน               |
| [โทร 1669] [โทรหาคนที่ไว้ใจ]               |
| [ดูประวัติการเช็กอิน]                      |
+------------------------------------------+
```

The footer appears for every answer and after saving. The named-sharing choice is disabled with an explanation if recipients cannot be loaded.

#### Scam-check result

```text
+------------------------------------------+
| ผลการตรวจ                                |
| [หยุด] เสี่ยงสูง — หยุดก่อน                |
| ยังไม่ต้องโอนเงินหรือส่งรหัส                |
|                                          |
| แอปยังยืนยันตัวผู้ส่งไม่ได้                 |
| [ โทรหาคนที่ไว้ใจ ]                        |
| [ เลือกคนให้ช่วยดูข้อความ ]                |
| [ โทร 1441 ]                              |
|                                          |
| จุดที่ควรระวัง                            |
| เร่งให้รีบทำ                              |
| > “ต้องทำภายในวันนี้”                     |
|                                          |
| ข้อมูลจากข้อความที่ได้รับ                  |
| เบอร์ในข้อความ: อย่าโทรตามเบอร์นี้          |
| > [ข้อความที่ทำให้กดติดต่อไม่ได้]           |
|                                          |
| วิธีตรวจสอบต่อ                            |
| 1. ปิดแชตหรือวางสาย                       |
| 2. ติดต่อผ่านช่องทางที่รู้จักเอง             |
| [ดูข้อความทั้งหมด] [ตรวจข้อความใหม่]       |
+------------------------------------------+
```

For other risk levels, retain the approved shared labels and corresponding neutral/amber treatment. Every result keeps uncertainty and an independent-verification action.

#### Guardian Pause result

```text
+------------------------------------------+
| ก่อนโอนเงิน หยุดคิดสักครู่                  |
| แอปไม่ได้ระงับการโอนเงิน                    |
|                                          |
| [หยุด] หยุดก่อน และตรวจสอบ                 |
| จำนวน 25,000 บาท                         |
| คำตอบที่ควรตรวจสอบ: มีคนเร่งให้โอน          |
|                                          |
| 1. วางสายหรือปิดแชต                       |
| 2. โทรกลับเบอร์ที่คุณรู้จักเอง               |
| 3. ถามคนที่คุณไว้ใจ                       |
|                                          |
| [ โทรหาคนที่ไว้ใจ ]                        |
| [ ติดต่อธนาคาร ]                          |
|   หากไม่มีรายการที่ยืนยันแล้ว:              |
|   ใช้เบอร์หลังบัตรหรือในสมุดบัญชี            |
| [ โทร 1441 ]                              |
|                                          |
| [ เลือกคนให้ช่วยดูผล ]                     |
| แชร์ช่วงจำนวนเงิน ไม่แชร์บันทึกส่วนตัว       |
+------------------------------------------+
```

The fourth action—stop and verify—is represented by the visible step sequence. For the lower-risk branch, use **“ตรวจสอบผู้รับก่อนตัดสินใจ”** and retain the same actions.

#### Help status

```text
+------------------------------------------+
| คำขอความช่วยเหลือ                         |
| บันทึกคำขอเมื่อ 14:32                      |
| แอปไม่ได้แจ้งหน่วยงานให้อัตโนมัติ           |
|                                          |
| นก · ในแอป                               |
| ส่งแล้ว 14:32 / ยังไม่ได้กดรับทราบ          |
|                                          |
| อนันต์ · อีเมล                             |
| จำลองการส่งเท่านั้น                        |
|                                          |
| ตรวจสถานะล่าสุดเมื่อ 14:33                 |
| [ ตรวจสถานะอีกครั้ง ]                      |
|                                          |
| [ โทรหาคนที่ไว้ใจ ]                        |
| [ เปิดเบอร์ฉุกเฉินตามเหตุ ]                |
|                                          |
| เมื่อมีผู้กดรับทราบ:                       |
| “นกกดรับทราบแล้ว เวลา 14:34”               |
| ยังไม่ยืนยันว่าจะติดต่อกลับเมื่อไร           |
+------------------------------------------+
```

If refresh fails, replace the freshness line with **“ตรวจสถานะล่าสุดไม่ได้”**, retain the previous timestamp and keep call actions visible. If there are no recipients, say **“ยังไม่ได้ส่งถึงใคร”**.

#### Family dashboard card

```text
+------------------------------------------+
| คุณสมศรี · แม่                            |
| [ข้อมูล] ไม่ต้องดำเนินการ                  |
| จากข้อมูลที่คุณสมศรีแชร์ไว้เท่านั้น           |
| แอปนี้ไม่ได้ประเมินสุขภาพ                   |
| ข้อมูลที่แชร์ล่าสุด: 5 พ.ย. 2569 เวลา 09:10 |
|                                          |
| เช็กอินที่แชร์ล่าสุด                        |
| “ก็ดี” · วันนี้ 09:10                      |
|                                          |
| [ ดูคำขอที่รอรับทราบ ]                     |
| แชร์กับคุณ: เช็กอิน, คำขอความช่วยเหลือ      |
| [ ดูข้อมูลอื่นที่แชร์ ]                     |
+------------------------------------------+
```

For no shared data, retain the separate approved `not_shared` label. No green tick, “everything is fine” illustration or missing-data escalation.

## 3. Thai microcopy improvements

Keep `DASHBOARD_LABELS`, `MOOD_LABELS` and `RISK_LABELS` as the approved source of truth. The changes below target supporting copy and action wording in `lib/i18n/th.ts`; update corresponding English keys together.

| Current string / key | Proposed string | Reason |
|---|---|---|
| `welcome.promise1`: เช็กอินบอกความรู้สึกได้ในไม่ถึงหนึ่งนาที | เช็กอินบอกความรู้สึกได้ ตามเวลาที่คุณสะดวก | Removes speed pressure. |
| `common.networkError`: ติดต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง | เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ต แล้วกดลองใหม่ | Removes technical terminology; requires a retry control. |
| `login.error.rate`: ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่ | ตอนนี้ยังเข้าสู่ระบบไม่ได้ กรุณารอสักครู่แล้วลองใหม่ | Avoids blame. |
| `home.tile.meds.soon`: เร็วๆ นี้ | ยังไม่เปิดใช้ | States availability without an unsupported date promise. |
| `checkin.sharingDefault`: ถ้าไม่เลือก “เฉพาะฉัน”… | หากเลือกแชร์ คนเหล่านี้จะเห็นความรู้สึก: {names} | Names the audience before saving; use with explicit choice. |
| `checkin.savedOnlyMe`: แชร์กับ: เฉพาะฉัน | บันทึกไว้เฉพาะฉัน | Private storage is not sharing. |
| `checkin.savedShared`: แชร์ตามการตั้งค่าในหน้า การแชร์ข้อมูล | บันทึกแล้ว ยังตรวจรายชื่อผู้ที่ดูได้ไม่ได้ | Do not substitute vague certainty for failed recipient lookup. |
| `checkin.trendTitle`: บันทึกของฉัน — ประวัติการเช็กอิน 14 วัน | ประวัติการเช็กอินของฉัน | Shorter; keep “14 วัน” as supporting text. |
| `checkin.noData`: ไม่มีข้อมูล | ยังไม่ได้บันทึก | Describes a gap without interpretation. |
| `contacts.started`: เริ่มโทรจากแอป — {name} เวลา {time} | ขอเปิดแอปโทรศัพท์เพื่อโทรหา {name} เวลา {time} | Accurately describes handing off a `tel:` link. |
| `emergency.started`: เริ่มโทรจากแอป — {name} | ขอเปิดแอปโทรศัพท์เพื่อโทรหา {name} | Same limit applies. |
| `alert.callStarted`: เริ่มโทรจากแอป | ขอเปิดแอปโทรศัพท์แล้ว | Avoids claiming a call began. |
| `scam.why`: ทำไมถึงคิดแบบนี้ | จุดที่ควรระวัง | Concrete and less anthropomorphic. |
| `scam.notSure`: สิ่งที่เรายังไม่แน่ใจ | สิ่งที่แอปยังยืนยันไม่ได้ | Makes the uncertainty explicit. |
| `scam.shareDone`: ส่งให้ {names} ช่วยดูแล้ว | แชร์ผลให้ {names} แล้ว ยังไม่ยืนยันว่าเปิดดู | Separates sharing from reading. |
| `pause.careTitle`: โอนได้ด้วยความระมัดระวัง | ตรวจสอบผู้รับก่อนตัดสินใจ | Removes implied permission to transfer. |
| `pause.careBody`: ไม่พบสัญญาณเตือนจากคำตอบของคุณ แต่ยังควรตรวจชื่อบัญชีผู้รับอีกครั้งก่อนโอน | คำตอบนี้ยังยืนยันผู้รับไม่ได้ กรุณาตรวจสอบผ่านช่องทางที่คุณรู้จักเอง | Avoids reassurance based on a short questionnaire. |
| `help.sentAt`: ส่งคำขอเมื่อ {time} | บันทึกคำขอเมื่อ {time} | Creation time does not prove delivery. |
| `help.noRecipients`: ยังไม่มีใครถูกตั้งให้รับคำขอนี้ | ยังไม่ได้ส่งถึงใคร กรุณาเลือกผู้รับคำขอ | Clear outcome and next step. |
| `help.acked`, `alert.ackedBy`: {name} รับทราบแล้ว เวลา {time} | {name} กดรับทราบแล้ว เวลา {time} | Describes an observable action. |
| `state.acknowledged`: {name} รับทราบแล้ว | {name} กดรับทราบแล้ว | Same distinction in delivery rows. |
| `alert.whoTold`: ใครได้รับแจ้งบ้าง | สถานะการส่งถึงแต่ละคน | Includes queued, failed and simulated attempts. |
| `notif.markSeen`: เห็นแล้ว | ทำเครื่องหมายว่าเปิดดูแล้ว | Clearly describes a user action. |
| `emergency.unverified`: รอการยืนยันข้อมูล | ข้อมูลเบอร์นี้ยังรอผู้ดูแลตรวจสอบ | Clarifies what is unverified. |
| `privacy.expiryLabel`: เมื่อกดแชร์ จะแชร์นานเท่าไร | แชร์ข้อมูลนี้กับ {name} นานเท่าไร | Makes duration specific to the recipient and grant. |

For simulated channels, replace the whole lead sentence with **“จำลองการส่งถึง {name} เท่านั้น”**. A small simulation suffix below an otherwise confident delivery sentence is insufficient.

Use polite requests such as “กรุณา” sparingly. Retain the existing user-selected polite-particle mechanism; do not infer particle preference from age, name or gender.

**Spec reconciliation:** UX §4 still describes verbally shared invitation codes. The implementation uses invitation links and explicitly warns against reading codes aloud. Preserve the implemented link/confirmation flow and update the older spec wording.

## 4. Accessibility findings

Criterion references use [WCAG 2.2](https://www.w3.org/TR/WCAG22/). “Risk” means browser verification is still required; product-baseline issues are not automatically WCAG failures.

| Finding and evidence | Criterion / classification | Fix |
|---|---|---|
| All routes inherit the generic `FamilyGuardian` title from `app/layout.tsx:16`; inspected pages provide no distinct title. | **2.4.2 Page Titled** — source-confirmed gap | Set a localised, descriptive title for every route. This also improves route announcements. |
| Large language buttons each have `min-width:7em` at `1.15rem`; their parent cannot wrap (`app/globals.css:93–97`). At the default senior size they require approximately 326px inside a 288px content area at a 320px viewport. | **1.4.10 Reflow** — calculated overflow | Allow wrapping/stacking and remove the large minimum width. Verify both languages with enlarged text. |
| Language-toggle parent uses `overflow:hidden`, potentially clipping the global offset focus outline (`app/globals.css:70,93`). | **2.4.7 Focus Visible** — rendering risk | Put rounded backgrounds on the buttons; keep the focus container unclipped. |
| SharePanel validation and fetch errors appear as plain paragraphs while focus remains on the action (`components/SharePanel.tsx:42–46,87`; `components/ui.tsx:19–25`). | **4.1.3 Status Messages** — announcement gap | Keep an empty alert region mounted; update its contents on failure. Focus the first checkbox for empty selection. |
| Successful mark-seen changes only the chip; failure is discarded (`app/notifications/page.tsx:23–29,45`). | **4.1.3 Status Messages** — announcement/recovery gap | Add persistent success/error announcements and retry. |
| Contact and invitation validation leaves focus on submit; field errors are outside an alert region (`app/contacts/page.tsx:48–55,120–134`; `app/privacy/page.tsx:130–136,267–275`). | **3.3.1 Error Identification** — discoverability risk; errors already exist visually and are linked | Focus the first invalid input and provide an announced error summary with links. |
| Guardian Pause removes the focused result when restarting without restoring focus (`app/guardian-pause/page.tsx:72–78`). Check-in reset similarly removes its focused confirmation (`app/checkin/page.tsx:79–85`). | **2.4.3 Focus Order** — focus-loss risk | After reset, focus the first relevant input or group heading. |
| Sticky emergency bar can cover focused content and has no safe-area allowance (`app/globals.css:157–158`). | **2.4.11 Focus Not Obscured** — rendering risk | Reserve dock space, add safe-area padding and scroll padding; test keyboard navigation at zoom. |
| Header links, language controls, back links and text-button actions are 44px; some standalone links have no target styling (`app/globals.css:87–107`; `app/home/page.tsx:46–47`). | **Product 56px baseline gap**; assess **2.5.8** separately | Make senior navigation/actions at least 56px. Existing 44px controls do not inherently fail the WCAG minimum. |
| Headings use `1.35` line-height and buttons `1.3` (`app/globals.css:62,113`). | Thai-readability/product gap; **1.4.12 Text Spacing** requires rendered checks | Use the proposed looser line-heights; verify no clipping with spacing overrides. |

**Already implemented and worth preserving:** skip link and main landmark; document-language updates; native labelled inputs and radio groups; visible focus styling; no zoom restriction; native modal dialogs; reduced-motion handling; high text contrast; and equal-sized check-in options.

Before acceptance, test keyboard-only use, Thai VoiceOver/TalkBack, 200% text enlargement, 320 CSS-pixel reflow, forced colours, long names and failed-network states. Do not claim these tests have passed from source inspection alone.

## 5. Prioritised implementation list

All paths are relative to `apps/web/` unless stated otherwise. Snippets are proposals only.

1. **P0 — Remove transfer permission wording.**  
   Change `pause.careTitle` and `pause.careBody` in `lib/i18n/th.ts:185–186` and corresponding English keys. Keep the existing result level enum; this is a presentation correction.

2. **P0 — Make help freshness truthful.**  
   In `app/help/page.tsx:28–48`, track initial loading, refresh failure and last successful check separately. Show the previous state with its timestamp on refresh failure; do not silently present it as current. Add a manual refresh action.

3. **P0 — Keep help alternatives visible after acknowledgement.**  
   Replace the condition at `app/help/page.tsx:115` with an always-available call/contact section. Explain that pressing acknowledge does not establish when contact will follow.

4. **P0 — Fix simulated-delivery presentation.**  
   In `components/DeliveryList.tsx:16–25`, make simulation the primary sentence:

   ```tsx
   <span>
     {simulated
       ? t('state.simulated', { name: d.recipientName })
       : t(`state.${d.state}`, { name: d.recipientName })}
   </span>
   ```

   Add `state.simulated` to both catalogues. Retain technical state details underneath; do not count simulated attempts as confirmed delivery.

5. **P0 — Correct call and acknowledgement copy everywhere.**  
   Update the keys listed in §3. In `lib/visual.ts:36` and `app/help/page.tsx:103–107`, replace the green/completion treatment with neutral information styling. In `app/alerts/[id]/page.tsx:91–102`, render call status in a separate persistent live region so acknowledgement cannot hide it.

6. **P0 — Make check-in audience explicit.**  
   In `app/checkin/page.tsx:19,152–175`, initialise private mode and replace the inverse checkbox with two radio options:

   ```tsx
   const [onlyMe, setOnlyMe] = useState(true);

   // Audience radio group:
   // 1. Only me
   // 2. Share with the named, currently eligible recipients
   ```

   Disable the sharing option while recipient lookup is unresolved or failed; allow private saving. This fits the current `onlyMe` contract. Selecting individual recipients requires a contract extension—do not display unsupported controls.

7. **P0 — Show help recipients before sending.**  
   In `app/help/page.tsx:73–85`, load active `help_requests` grants and show names, distinct loading/error states and a no-recipient explanation. Recheck on submission through the API; frontend preview is informational.

8. **P0 — Put scam actions before long evidence.**  
   Reorder `app/scam-check/page.tsx:109–160` to verdict → uncertainty → call/share actions → evidence → full submitted text. Add a contacts link independent of whether sharing grants exist.

9. **P0 — Complete evidence presentation protections.**  
   In `app/scam-check/page.tsx:119,139`, label numbers as originating in the submitted message and warn against calling them. Preserve `formatDetection` in `app/layout.tsx:21` and `defang()`. Apply inert rendering to untrusted alert summaries in `app/alerts/[id]/page.tsx:83`. Add `maxLength={2048}` to `scam-url`; server parsing/normalisation remains an engineering dependency.

10. **P0 — Fix senior notification destinations.**  
    In `app/notifications/page.tsx:60–63`, route seniors to their own help/scam/pause experience according to the notification’s supported metadata. If no senior detail route exists, omit that detail link and explain availability. Add `/notifications` to senior navigation in `components/AppShell.tsx:15–16`.

11. **P0 — Make sharing failures recoverable.**  
    Split the all-or-nothing load in `app/privacy/page.tsx:51–60` into independently tracked sections. A failed access-log request must not hide sharing controls. Add retry to `components/SharePanel.tsx:30–38`.

12. **P0 — Preserve shared-device privacy, SR-14.**  
    Keep full navigation/cache cleanup in `lib/session.tsx:58–68`. `next.config.ts:38–42` only explicitly sets no-store on API paths: confirm authenticated-document policy and test logout → Back, cross-tab logout and session revocation. If logout fails, do not imply server sign-out succeeded. Backend headers remain outside this UI review.

13. **P1 — Apply typography, targets and reflow fixes.**  
    Update `app/globals.css` with the final tokens and these overrides:

    ```css
    h1 { line-height: 1.5; }
    h2, h3 { line-height: 1.6; }
    .btn { line-height: 1.6; }

    html[data-audience='senior']
      :is(.brand, .site-nav a, .link-button,
          .lang-btn, .back-link a) {
      min-block-size: 56px;
      min-inline-size: 56px;
    }

    .lang {
      display: flex;
      flex-wrap: wrap;
      max-inline-size: 100%;
      overflow: visible;
      border-radius: 12px;
    }
    .lang-large .lang-btn {
      min-inline-size: 0;
      flex: 1 1 7rem;
      white-space: normal;
    }
    ```

14. **P1 — Add semantic amber and robust focus.**  
    In `app/globals.css:104,133–134,174,181`, use `--warm-ink` for routine validation and `--warm-border` for meaningful amber outlines. Keep red reserved for active warnings and emergency actions.

    ```css
    :focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
      box-shadow: 0 0 0 3px var(--surface);
    }
    .field-error { color: var(--warm-ink); }
    ```

15. **P1 — Reorganise home and emergency docking.**  
    In `app/home/page.tsx:8–48`, replace the unavailable medicine tile with Guardian Pause. Keep the roadmap notice outside navigation. Replace `.emergency-bar` styling in `app/globals.css:157` with a reserved dock:

    ```css
    html { scroll-padding-block-end: 10rem; }

    .site-main:has(.emergency-bar) {
      padding-block-end: calc(10rem + env(safe-area-inset-bottom));
    }
    .emergency-bar {
      position: fixed;
      inset-inline: 0;
      inset-block-end: 0;
      z-index: 20;
      padding: 12px 16px
        calc(12px + env(safe-area-inset-bottom));
      background: var(--bg);
      border-block-start: 1px solid var(--border);
    }
    .emergency-bar > a {
      max-inline-size: 36rem;
      margin-inline: auto;
    }
    ```

    Measure the wrapped dock at enlarged text and increase reservation accordingly; the snippet is not a substitute for that check.

16. **P1 — Add route titles and predictable focus.**  
    In `components/AppShell.tsx`, provide route-specific localised document titles using pathname and locale; retain the framework route announcer. Restore focus after resets in `app/checkin/page.tsx` and `app/guardian-pause/page.tsx`.

17. **P1 — Announce errors and notification changes.**  
    In `components/SharePanel.tsx:87`, keep an alert container mounted:

    ```tsx
    <div role="alert" aria-atomic="true">
      <ErrorText id={`share-err-${category}`}>{error}</ErrorText>
    </div>
    ```

    In `app/notifications/page.tsx:23–29`, replace the swallowed failure with an error message and add a persistent `Status` region for success. Focus first-invalid inputs in contacts and privacy invitation forms.

18. **P1 — Make correction and revocation concrete.**  
    `app/checkin/page.tsx` has no undo; `lib/api.ts:71–73` exposes only creation/history. Define a real correction/retraction operation before displaying Undo. Offer a persistent correction route plus an optional 10-second shortcut. In `app/privacy/page.tsx`, add stop-all-sharing with explicit confirmation of scope; disclose that previously viewed information cannot be recalled.

19. **P1 — Reduce privacy and invitation complexity.**  
    In `app/privacy/page.tsx`, place duration inside each share decision and group access logs/devices below current permissions. In `app/invite/accept/page.tsx`, show the current account, hide a prefilled token behind details and provide switch-account recovery.

20. **P1 — Preserve neutral family meaning.**  
    In `app/family/page.tsx:25–33`, name the senior in the shared-data limitation. Move pending requests before optional history; label older check-ins explicitly. Add manual refresh. In `app/admin/page.tsx:22`, display unavailable counts as unavailable instead of zero.

21. **P1 — Finish login, emergency and billing recovery.**  
    Add password visibility in `app/login/page.tsx`; preserve paste/autofill. Add directory provenance in `app/emergency/page.tsx`. Give subscription loading its own error state and disable repeat checkout requests in `app/billing/page.tsx`. Keep bank entries hidden until their existing verification requirement is met; retain SR-17 prerequisites for any future editor.

22. **P2 — Refine icons, reading support and validate with seniors.**  
    Update `app/icon.svg`, `public/icon.svg`, `lib/visual.ts` and home icons consistently. Add optional read-aloud controls to result and help screens with stop/replay and no automatic speech. Test the five senior flows and family card with Thai adults aged 65–85 and adult children, including low vision and limited dexterity; revise terminology from observed comprehension.