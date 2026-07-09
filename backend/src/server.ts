import type { Request, Response } from 'express';
import { createApp } from './app';
import { ensureCoreSeed } from './bootstrap/ensureCoreSeed';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './db/prisma';
import { initAuth } from './lib/auth';
import { importEsm } from './lib/esm';
import { startScheduler } from './scheduler';

async function main(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');

  await ensureCoreSeed(prisma);

  // Initialise Better Auth (ESM) and build its Node handler before the app so
  // the catch-all route can be mounted synchronously in createApp().
  const auth = await initAuth();
  const { toNodeHandler } = await importEsm<typeof import('better-auth/node')>('better-auth/node');
  const authHandler = toNodeHandler(auth) as (req: Request, res: Response) => void;
  logger.info('Better Auth initialised');

  const app = createApp(authHandler);
  const server = app.listen(env.PORT, () => {
    logger.info(`CDS backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const scheduler = startScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    clearInterval(scheduler);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
