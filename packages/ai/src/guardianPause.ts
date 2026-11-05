// Guardian Pause: a 4-question pause before a money transfer. Simulation only — never touches a bank.
import type { GuardianPauseEngineResult, GuardianPauseReq } from '@fg/shared';
import { scoreScam } from './assess';
import { PAUSE } from './copy';
import type { Bi } from './rules';

export const LARGE_AMOUNT_THB = 10_000;

export function evaluateGuardianPause(req: GuardianPauseReq): GuardianPauseEngineResult {
  const a = req?.answers ?? ({} as GuardianPauseReq['answers']);
  // Missing answers are treated as the cautious answer (we never assume the reassuring one).
  const knows = a.knowsRecipientPersonally === true;
  const verified = a.verifiedIndependently === true;
  const secret = a.toldToKeepSecret !== false;
  const pressured = a.pressuredToActNow !== false;

  const reasons: Bi[] = [];
  if (!knows && !verified) reasons.push(PAUSE.unknownUnverified);
  else if (!knows) reasons.push(PAUSE.unknown);
  else if (!verified) reasons.push(PAUSE.unverified);
  if (secret) reasons.push(PAUSE.secret);
  if (pressured) reasons.push(PAUSE.pressure);

  const riskAnswers = [!knows, !verified, secret, pressured].filter(Boolean).length;
  let stop = (!knows && !verified) || secret || pressured || riskAnswers >= 2;

  const amount = Number(req?.amountThb);
  if (!Number.isFinite(amount) || amount <= 0) reasons.push(PAUSE.amountUnclear);
  else if (amount >= LARGE_AMOUNT_THB) reasons.push(PAUSE.largeAmount); // adds a reason, never triggers stop alone

  if (typeof req?.recipientNote === 'string' && req.recipientNote.trim()) {
    const s = scoreScam({ text: req.recipientNote });
    if (s.risk === 'high_risk' || s.risk === 'caution') reasons.push(PAUSE.noteRisk);
    if (s.risk === 'high_risk') stop = true; // can only make the result more cautious
  }

  if (!stop) reasons.push(PAUSE.proceedWithCare);
  return { level: stop ? 'stop_and_verify' : 'proceed_with_care', reasons };
}
