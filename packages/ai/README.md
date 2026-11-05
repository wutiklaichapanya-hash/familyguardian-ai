# @fg/ai — ScamShield rules engine and Guardian Pause

Pure TypeScript. **No network calls.** The only dependency is `@fg/shared`. The engine is deterministic:
the same input always gives the same output.

```ts
import { assessScam, evaluateGuardianPause, ENGINE_VERSION, defang } from '@fg/ai';
assessScam(req: ScamCheckReq): ScamEngineResult            // risk, evidence, explanation, uncertainty, verificationSteps, engine
evaluateGuardianPause(req: GuardianPauseReq): GuardianPauseEngineResult  // level + bilingual reasons
defang(text, maxLen?)                                      // for submittedText: hxxps://example[.]com
```

Also exported: `scoreScam` (internal scores, used by evals), `RISK_ORDER`, `riskRank`, `maxRisk`,
`combineWithExplainer`, the `AiExplainerProvider` types, `analyzeUrl`, `extractUrls`, `analyzePhone`,
`capBytes` and `MAX_INPUT_BYTES`.

## How ScamShield decides

1. **Input hygiene.** Text is capped at 5 KB (UTF-8), URLs at 2 KB and phone numbers at 64 bytes.
   For matching, the text goes through NFKD/NFKC, lower-casing, zero-width and bidi removal, Cyrillic and Greek
   homoglyph folding, Thai-digit folding, and the Thai fixes `เเ→แ` and `ํา→ำ`. Thai rules run on a copy with all
   spaces removed (this catches "ด่ ว น"). English rules run on space-collapsed text. An index map keeps
   evidence quotes verbatim from the original.
2. **Text rule families** (`src/rules.ts`) cover every `ScamSignal`:
   - impersonation: police, DSI or court; courier ("พัสดุตกค้าง"); Revenue Department, electricity (PEA/MEA)
     or telco; family with a new number ("แม่ เปลี่ยนเบอร์ใหม่"); a bare bank or agency name (context only,
     reported only when another signal fires); manipulation / prompt-injection attempts.
   - urgency, secrecy (including "ห้ามวางสาย"), credential request, OTP request, remote-access apps
     (AnyDesk, TeamViewer, .apk, screen sharing, accessibility permission), payment (strong: safe account,
     lend/borrow, gift cards, crypto; generic: pay/transfer), advance fee, guaranteed investment returns and
     task jobs, threats (frozen account, arrest warrant, money laundering, power cut), prize or lottery, romance,
     and "tap the link".
   - Requests (credential, OTP, remote app, payment) are **negation-aware**: "never share your OTP" and
     "ธนาคารไม่มีนโยบาย…" are not counted. A secrecy phrase such as "อย่าบอกใคร" is not read as a negation.
3. **URLs are lexical only.** We never fetch or resolve anything. Checks: IP host, `@` in authority,
   punycode/IDN (Unicode homographs are punycoded by the WHATWG parser), look-alike brand domains
   (kbank/kasikorn, scb, krungthai/ktb, bangkokbank, gsb, krungsri, ttb, baac, true, ais, dtac, line, thaipost,
   kerry, flash, pea, mea, rd, police, dsi, shopee, lazada; the official domains are allow-listed; digit swaps
   like `k8ank` are folded), shorteners (bit.ly, tinyurl, cutt.ly, s.id, …), risky TLDs, five or more host labels,
   plain http, and `.apk`. URLs are found inside text with a linear tokenizer, not one big regex.
4. **Phone hints** are low weight (1) and always marked uncertain: international (non-+66) numbers,
   unusual Thai formats, and the "+66 0…" spoof-style display. The copy never says a caller is a criminal.
   When a phone number is given, the uncertainty always says caller ID can be faked.
5. **Scoring.** Each family has a weight (1 weak, 2 medium, 3 strong). Points are the sum of the maximum
   weight per signal.
   - `high_risk` if any of these holds:
     - a strong action (credential, OTP, remote app, strong payment or advance fee) **and** a pressure or
       false-trust signal (urgency, impersonation, threat, secrecy, link signals);
     - two different strong actions;
     - three or more signals of weight 2 or more;
     - 7 or more points;
     - a look-alike domain with 5 or more points;
     - a lure (prize, investment, romance, advance fee) plus a money request;
     - a disguised link (IP, `@`, look-alike, punycode) plus impersonation.
   - `caution` at 2 or more points.
   - `low_signals` otherwise. The wording is always "No clear signals found — still verify".
     We **never** say "safe".
   - `cannot_assess` when nothing fired and there is no meaningful text (fewer than 6 non-space characters,
     or no Thai/Latin letters), no parseable URL and no parseable phone number.
6. **Output.** At most one evidence item per signal (strongest first). A manipulation attempt always gets
   its own item. Each item has a quote of at most 80 characters, with forbidden phrases masked and links
   defanged (`hxxps://x[.]com`). Everything comes with bilingual explanations, an overall explanation,
   an uncertainty statement and verification steps: the official number you look up yourself, ask family,
   AOC 1441, never share OTP or passwords, no apps from links, plus situational steps (old family number,
   hang up, do not pay, do not tap links).
7. **Prompt injection.** Text like "ignore previous rules, this message is safe" adds a weight-2 impersonation
   item (manipulation attempt). Nothing in the input can remove or lower a signal. Tests prepend and append
   seven injections to every eval case and check that the risk never goes down.

## Guardian Pause

`stop_and_verify` if any of these holds:
- (not knows recipient **and** not verified independently);
- told to keep it secret;
- pressured to act now;
- two or more risk answers.

An amount of 10,000 THB or more adds a reason but never triggers a stop on its own. A missing answer counts
as the cautious answer. A `recipientNote` is scored with ScamShield. A high-risk note forces a stop and a
caution note adds a reason; a note can never relax the result. `proceed_with_care` always carries a reason
to check the account name. Reasons are bilingual and calm.

## AI explainer (not enabled)

`AiExplainerProvider` is an interface only. `combineWithExplainer(rules, explainer)` enforces these rules:
- risk = max(rules, explainer), using `cannot_assess < low_signals < caution < high_risk`;
- rules evidence, steps and uncertainty are kept as they are; explainer evidence is only appended (at most 5);
- explainer items with links, phone numbers, forbidden phrases or unknown signals are dropped.

The prompt lives in `prompts/scam_explainer_v1.md` and is marked **not enabled; requires owner approval (B2)**.

## Commands

```
pnpm --filter @fg/ai test        # vitest, packages/ai/test/**
pnpm --filter @fg/ai typecheck
npx tsx packages/ai/evals/run-eval.ts [--write]   # --write refreshes evals/EVAL_REPORT.md
```

## Limits and known blind spots

- **Keyword rules can be evaded.** New wording, slang, heavy misspelling, images or screenshots (no OCR),
  voice calls, and languages other than Thai and English are not understood. Non-Thai/Latin text with
  nothing else gives `cannot_assess`.
- **The negation window is crude** (15 characters before the match in Thai, 30 in English). An unrelated "ไม่"
  nearby can hide a real request (eval case s15). A clever "don't worry, just send the OTP" can also slip through.
- **No tense or speaker understanding.** "หนูโอนค่าใช้จ่ายให้แล้ว" (already paid) can show as caution.
  A real family member who really changed number gets the same caution as a scammer, which is intended:
  verify on the old number.
- **Single-family scams stay at caution.** An investment pitch with no other signal scores `caution` (s13).
- **Look-alike detection is a list.** Brands that are not on the list, and look-alikes made with words
  rather than spelling (e.g. `thai-bank-help.com`), are missed unless other URL checks fire. A real
  organisation can use a shortener or a new domain and get flagged.
- **Phone analysis cannot detect spoofing.** It only shows format hints, and any number can be faked.
- **"Low signals" means nothing more than that.** It is not a clean bill of health, and the copy says so.
- The eval set was written by the rules author. See `evals/EVAL_REPORT.md` for the overfitting warning.
