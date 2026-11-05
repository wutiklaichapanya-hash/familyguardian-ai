# ScamShield rules engine — evaluation report

Command: `npx tsx packages/ai/evals/run-eval.ts --write` (the block below is written by the script)
Dataset: `packages/ai/evals/scam_cases.json`: 81 **synthetic** cases (47 scam incl. 5 prompt-injection scams,
25 benign, 9 edge incl. 1 injection-only). Thai and English. Fictitious numbers, example domains.

Metric definitions
- **Recall**: share of scam cases with risk ∈ {caution, high_risk}.
- **False-positive rate**: share of benign cases with risk = high_risk.
- Benign cases at `caution` are reported separately as friction. They are not counted as false positives.

## Current numbers

<!-- EVAL:START -->
```text
Engine: rules rules-1.1.0 · cases: 81 (scam 47, benign 25, edge 9)
Recall on scam cases (risk ∈ {caution, high_risk}): 47/47 = 100.0%
High-risk recall (cases expected high_risk that got high_risk): 29/31 = 93.5%
False-positive rate on benign cases (risk = high_risk): 0/25 = 0.0%
Benign cases shown as caution (not counted as FP, but friction): 1/25 = 4.0%
Cases meeting their expected range: 79/81 = 97.5%
```

| label \ predicted | cannot_assess | low_signals | caution | high_risk | total |
|---|---|---|---|---|---|
| scam | 0 | 0 | 13 | 34 | 47 |
| benign | 0 | 24 | 1 | 0 | 25 |
| edge | 5 | 3 | 1 | 0 | 9 |

**Cases outside expected range**

- s13 (scam/investment): expected high_risk+, got **caution** [investment_promise]
- s15 (scam/loan_advance_fee): expected high_risk+, got **caution** [advance_fee]
<!-- EVAL:END -->

## Contract v0.3 re-run (2026-11-05, engine rules-1.1.0)

Prompt-injection phrases now report the new `ScamSignal` `manipulation_attempt` instead of `impersonation`.
Scoring treats it as a pressure / false-trust signal, exactly as impersonation was treated before, so no
case changed risk: the numbers above (re-run with `--write` after the change) are identical to rules-1.0.0
(recall 47/47, high-risk recall 29/31, benign high_risk 0/25, benign caution 1/25, in range 79/81).
The only visible difference is the evidence signal on the 5 injection scams and the injection-only edge case.

## First run (before any change), kept for honesty

The first run against this set, before I changed any rule:
recall 47/47 = 100.0%, high-risk recall 25/31 = 80.6%, benign high_risk 0/25 = 0.0%, benign caution 0/25,
cases in expected range 75/81.

After that run I made three **general** scoring changes. I did not add any case wording to the rules.
1. A lure (prize, loan fee, investment, romance) plus a money request means `high_risk`.
2. A disguised link (IP host, `@`, look-alike brand, punycode) plus any impersonation means `high_risk`.
3. I added "ทางราชการ / หน่วยงานรัฐ / เจ้าหน้าที่รัฐ / กระทรวง" to the organisation mentions, and
   "โอนค่า / ย้ายเงิน" to generic payment wording.

Side effect: change 3 moved one benign case (b17, a child saying "หนูโอนค่าใช้จ่ายให้แล้ว", meaning
"I already sent the money") from low_signals to caution. I left it that way. It shows the rules
cannot read tense.

## Remaining misses (not fixed on purpose)

- **s13**: an investment scam with only investment wording ("กำไร 30% ต่อวัน การันตี ไม่มีความเสี่ยง")
  scores `caution`, not `high_risk`. A single signal family stays at caution by design.
- **s15**: a Thai loan advance-fee message. The word "ไม่" in "ไม่เช็คบูโร" sits within 15 characters of
  "ต้องโอนค่าธรรมเนียม", and the crude negation window suppresses the payment match. This is a real
  blind spot of the negation heuristic.

## Overfitting warning: read before trusting these numbers

**One author wrote both the rules and these cases, in the same session.** The cases inevitably use
wording the author already had in mind, so recall of 100% here **does not** predict real-world recall.
Real scam messages change wording quickly, use slang, misspellings and images, and arrive in languages
other than Thai or English. The benign set is small (25) and hand-picked, so a 0% false-positive rate
is weak evidence.

Recommendations:
1. Ask an **independent person** (not the rules author) to write a **held-out set** of at least 100
   synthetic or properly anonymised cases: scams based on public AOC / bank warnings, and real-looking
   benign messages from family chats, clinics and bank notices. Run it once and report the numbers.
   Do not tune on it.
2. Track caution-on-benign friction as well as high_risk false positives. Too many cautions train
   users to ignore warnings.
3. Re-run the eval in CI so that rule changes show their effect on both sets.
