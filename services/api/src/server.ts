// Entry point: `pnpm dev:api`. Starts Fastify + the in-process pg-boss notification worker.
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const { app, close } = await buildApp();
let closing = false;
const shutdown = async (sig: string) => {
  if (closing) return;
  closing = true;
  app.log.info({ sig }, 'shutting down');
  await close().catch((err) => app.log.error({ err }, 'shutdown error'));
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
await app.listen({ port: config.port, host: process.env.HOST ?? 'localhost' });
