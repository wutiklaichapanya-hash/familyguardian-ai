// @fg/ai — ScamShield rules engine + Guardian Pause. Pure TypeScript: no network, no deps beyond @fg/shared.
export { ENGINE_VERSION, assessScam, scoreScam, RISK_ORDER, riskRank, maxRisk } from './assess';
export { evaluateGuardianPause, LARGE_AMOUNT_THB } from './guardianPause';
export { combineWithExplainer, EXPLAINER_PROMPT_VERSION } from './explainer';
export type { AiExplainerProvider, AiExplainerInput, AiExplainerResult } from './explainer';
export { defang, capBytes, MAX_INPUT_BYTES } from './normalize';
export { analyzeUrl, extractUrls } from './url';
export { analyzePhone } from './phone';
