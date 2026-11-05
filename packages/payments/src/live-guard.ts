/**
 * Live payments are OFF by default. assertLiveAllowed throws unless ALL of:
 *   1. PAYMENTS_MODE === 'live'
 *   2. provider credentials are present (PAYMENTS_PROVIDER_KEY and PAYMENTS_WEBHOOK_SECRET, non-empty)
 *   3. RELEASE_PAYMENTS_SIGNED === 'true' (owner has signed the payments release)
 * Call it before constructing any non-sandbox adapter.
 */
export type LiveGuardEnv = Record<string, string | undefined>;

export const LIVE_CREDENTIAL_KEYS = ['PAYMENTS_PROVIDER_KEY', 'PAYMENTS_WEBHOOK_SECRET'] as const;

export class LivePaymentsDisabledError extends Error {
  readonly code = 'LIVE_PAYMENTS_DISABLED' as const;
  constructor(readonly reasons: string[]) {
    super(`LIVE_PAYMENTS_DISABLED: ${reasons.join('; ')}`);
    this.name = 'LivePaymentsDisabledError';
  }
}

export function liveBlockers(env: LiveGuardEnv): string[] {
  const reasons: string[] = [];
  if (env.PAYMENTS_MODE !== 'live') reasons.push("PAYMENTS_MODE is not 'live'");
  for (const k of LIVE_CREDENTIAL_KEYS) {
    if (!env[k] || env[k]!.trim() === '') reasons.push(`${k} is missing`);
  }
  if (env.RELEASE_PAYMENTS_SIGNED !== 'true') reasons.push("RELEASE_PAYMENTS_SIGNED is not 'true'");
  return reasons;
}

export function assertLiveAllowed(env: LiveGuardEnv): void {
  const reasons = liveBlockers(env);
  if (reasons.length > 0) throw new LivePaymentsDisabledError(reasons);
}

export function isLiveAllowed(env: LiveGuardEnv): boolean {
  return liveBlockers(env).length === 0;
}
