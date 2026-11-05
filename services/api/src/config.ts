// Runtime configuration from environment variables (see README for the list).
export interface AppConfig {
  nodeEnv: string;
  databaseUrl: string;
  port: number;
  webOrigin: string;
  sessionSecret: string;
  sessionTtlDays: number;
  sessionIdleHours: number;
  loginDelayBaseMs: number;
  helpFollowupMinutes: number;
  notifyMaxRetries: number;
  notifyRetryBaseSeconds: number;
  notifyForceFail: boolean;
  rateLimitGlobalMax: number;
  loginRateLimitMax: number;
  inviteTtlHours: number;
  inviteMaxAttempts: number;
  scamCheckRateLimitMax: number;
  inviteRateLimitMax: number;
  helpRateLimitMax: number;
  logLevel: string;
  sandboxWebhookSecret: string;
  paymentsMode: string;
  /** POST /auth/register: max per IP per hour (v0.3). */
  registerRateLimitMax: number;
  /** Retention purge (v0.3): scam raw text days, Guardian Pause days, check-in months, pg-boss cron ('' = off). */
  retentionScamTextDays: number;
  retentionPauseDays: number;
  retentionCheckinMonths: number;
  purgeCron: string;
}

const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrides: Partial<AppConfig> = {}): AppConfig {
  const cfg: AppConfig = {
    nodeEnv: env.NODE_ENV ?? 'development',
    databaseUrl: env.DATABASE_URL ?? 'postgres://fg:fg_local_only@localhost:5433/familyguardian',
    port: num(env.API_PORT, 4100),
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:3100',
    sessionSecret: env.SESSION_SECRET ?? '',
    sessionTtlDays: num(env.SESSION_TTL_DAYS, 30),
    sessionIdleHours: num(env.SESSION_IDLE_HOURS, 12),
    loginDelayBaseMs: num(env.LOGIN_DELAY_BASE_MS, 250),
    helpFollowupMinutes: num(env.HELP_FOLLOWUP_MINUTES, 10),
    notifyMaxRetries: num(env.NOTIFY_MAX_RETRIES, 3),
    notifyRetryBaseSeconds: num(env.NOTIFY_RETRY_BASE_SECONDS, 5),
    notifyForceFail: env.NOTIFY_FORCE_FAIL === 'true',
    rateLimitGlobalMax: num(env.RATE_LIMIT_GLOBAL_MAX, 300),
    loginRateLimitMax: num(env.LOGIN_RATE_LIMIT_MAX, 5),
    inviteTtlHours: num(env.INVITE_TTL_HOURS, 72),
    inviteMaxAttempts: num(env.INVITE_MAX_ATTEMPTS, 5),
    scamCheckRateLimitMax: num(env.SCAM_CHECK_RATE_LIMIT_MAX, 30),
    inviteRateLimitMax: num(env.INVITE_RATE_LIMIT_MAX, 10),
    helpRateLimitMax: num(env.HELP_RATE_LIMIT_MAX, 10),
    logLevel: env.LOG_LEVEL ?? 'info',
    sandboxWebhookSecret: env.SANDBOX_WEBHOOK_SECRET ?? '',
    paymentsMode: env.PAYMENTS_MODE ?? 'sandbox',
    registerRateLimitMax: num(env.REGISTER_RATE_LIMIT_MAX, 5),
    retentionScamTextDays: num(env.RETENTION_SCAM_TEXT_DAYS, 30),
    retentionPauseDays: num(env.RETENTION_PAUSE_DAYS, 90),
    retentionCheckinMonths: num(env.RETENTION_CHECKIN_MONTHS, 12),
    purgeCron: env.PURGE_CRON ?? '17 3 * * *',
    ...overrides,
  };
  if (cfg.sessionSecret.length < 32) {
    if (cfg.nodeEnv === 'production') throw new Error('SESSION_SECRET must be at least 32 characters');
    cfg.sessionSecret = cfg.sessionSecret.padEnd(32, '-dev-only-');
  }
  return cfg;
}
