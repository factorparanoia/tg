import 'dotenv/config';

import { connectDatabase } from './database/prisma';
import { connectRedis } from './services/redis';
import { startHealthServer } from './services/health';
import { startReminderScheduler } from './reminders/scheduler';
import { createBot } from './bot';
import { logger } from './utils/logger';
import { config } from './utils/config';

async function bootstrap(): Promise<void> {
  logger.info('🌙 Midnight AI starting...');
  logger.info(`Environment: ${config.app.nodeEnv}`);

  // 1. Database
  await connectDatabase();

  // 2. Redis
  await connectRedis();

  // 3. Health server
  startHealthServer();

  // 4. Bot
  const bot = createBot();

  // 5. Reminder scheduler (needs bot instance)
  startReminderScheduler(bot);

  // 6. Launch
  await bot.launch({ dropPendingUpdates: true });
  logger.info('✅ Midnight AI is live!');

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down`);
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
