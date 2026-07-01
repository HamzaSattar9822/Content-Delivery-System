import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './db/prisma';
import { startScheduler } from './scheduler';

async function main(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');

  const app = createApp();
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
