// Job queue abstraction. Production: pg-boss (in-process worker). Tests: ManualQueue (drained explicitly).
import { PgBoss } from 'pg-boss';

export const JOB_DELIVER = 'notify-deliver';
export const JOB_FOLLOWUP = 'help-followup';
export const JOB_PURGE = 'retention-purge';
export type JobName = typeof JOB_DELIVER | typeof JOB_FOLLOWUP | typeof JOB_PURGE;
export type JobHandler = (data: Record<string, unknown>) => Promise<void>;

export interface JobQueue {
  send(name: JobName, data: Record<string, unknown>, delaySeconds?: number): Promise<void>;
  work(name: JobName, handler: JobHandler): Promise<void>;
  /** Cron schedule (UTC). pg-boss keeps one schedule per queue name, so re-registering just updates it. */
  schedule(name: JobName, cron: string): Promise<void>;
  stop(): Promise<void>;
}

export class PgBossQueue implements JobQueue {
  private boss: PgBoss;
  private started: Promise<unknown> | null = null;
  constructor(connectionString: string, private log: { error: (o: unknown, m?: string) => void } = console, private pollingIntervalSeconds = 1) {
    this.boss = new PgBoss({ connectionString, schema: 'pgboss', max: 4, application_name: 'fg-api-worker' });
    this.boss.on('error', (err) => this.log.error({ err }, 'pg-boss error'));
  }
  private async ready() {
    this.started ??= (async () => {
      await this.boss.start();
      for (const q of [JOB_DELIVER, JOB_FOLLOWUP, JOB_PURGE]) await this.boss.createQueue(q, { retryLimit: 2, retryDelay: 5, retryBackoff: true });
    })();
    await this.started;
  }
  async send(name: JobName, data: Record<string, unknown>, delaySeconds = 0) {
    await this.ready();
    await this.boss.send(name, data, delaySeconds > 0 ? { startAfter: delaySeconds } : {});
  }
  async work(name: JobName, handler: JobHandler) {
    await this.ready();
    await this.boss.work<Record<string, unknown>>(name, { pollingIntervalSeconds: this.pollingIntervalSeconds, batchSize: 5 }, async (jobs) => {
      for (const job of jobs) await handler(job.data);
    });
  }
  async schedule(name: JobName, cron: string) {
    await this.ready();
    await this.boss.schedule(name, cron, {}, { tz: 'UTC' });
  }
  async stop() {
    if (!this.started) return;
    await this.boss.stop({ graceful: true, timeout: 5000 });
  }
}

/** Deterministic in-memory queue for tests: jobs run only when drain() is called. Delays are recorded, not waited. */
export class ManualQueue implements JobQueue {
  jobs: { name: JobName; data: Record<string, unknown>; delaySeconds: number }[] = [];
  private handlers = new Map<JobName, JobHandler>();
  schedules = new Map<JobName, string>();
  async schedule(name: JobName, cron: string) { this.schedules.set(name, cron); }
  async send(name: JobName, data: Record<string, unknown>, delaySeconds = 0) { this.jobs.push({ name, data, delaySeconds }); }
  async work(name: JobName, handler: JobHandler) { this.handlers.set(name, handler); }
  async stop() {}
  pending(name?: JobName) { return this.jobs.filter((j) => !name || j.name === name); }
  /** Run queued jobs (optionally only one kind) until none are left of that kind. Returns jobs processed. */
  async drain(name?: JobName, maxJobs = 100): Promise<number> {
    let n = 0;
    for (;;) {
      const idx = this.jobs.findIndex((j) => !name || j.name === name);
      if (idx < 0 || n >= maxJobs) return n;
      const [job] = this.jobs.splice(idx, 1);
      const h = this.handlers.get(job!.name);
      if (!h) throw new Error(`no handler for ${job!.name}`);
      await h(job!.data);
      n++;
    }
  }
  /** Run exactly the jobs currently queued of this kind (not ones they enqueue). */
  async runOnce(name: JobName): Promise<number> {
    const batch = this.jobs.filter((j) => j.name === name);
    this.jobs = this.jobs.filter((j) => j.name !== name);
    for (const job of batch) await this.handlers.get(name)!(job.data);
    return batch.length;
  }
}
