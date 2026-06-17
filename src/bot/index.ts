import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { MidnightContext } from '../types';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { authMiddleware, errorMiddleware, typingMiddleware } from '../middleware/auth';
import { registerCommands } from './commands';
import { handleMessage } from './handlers/message';
import { handleDocument, handlePhoto } from './handlers/file';

export function createBot(): Telegraf<MidnightContext> {
  const bot = new Telegraf<MidnightContext>(config.telegram.token);

  bot.use(errorMiddleware);
  bot.use(authMiddleware);
  bot.use(typingMiddleware);

  registerCommands(bot);

  bot.on(message('text'), handleMessage);
  bot.on(message('document'), handleDocument);
  bot.on(message('photo'), handlePhoto);

  bot.telegram.setMyCommands([
    { command: 'start',     description: 'Start the bot' },
    { command: 'help',      description: 'Show all capabilities' },
    { command: 'memory',    description: 'View all memories' },
    { command: 'notes',     description: 'View all notes' },
    { command: 'tasks',     description: 'View active tasks' },
    { command: 'reminders', description: 'View active reminders' },
    { command: 'clear',     description: 'Clear conversation context' },
  ]).catch((err: unknown) => logger.warn('Failed to set bot commands:', err));

  logger.info('🤖 Bot configured');
  return bot;
}
