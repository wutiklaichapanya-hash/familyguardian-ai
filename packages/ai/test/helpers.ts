import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RiskLevel, ScamCheckReq } from '@fg/shared';
export interface EvalCase { id: string; label: string; input: ScamCheckReq; expectedMinRisk: RiskLevel; expectedMaxRisk?: RiskLevel }
export const EVAL_CASES: EvalCase[] = JSON.parse(readFileSync(join(__dirname, '..', 'evals', 'scam_cases.json'), 'utf8')).cases;
