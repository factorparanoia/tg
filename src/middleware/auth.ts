import { Context, MiddlewareFn } from 'telegraf';
import { prisma } from '../database/prisma';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { MidnightContext } from '../types';

async function ensureUser(telegramUser: NonNullable<Context['from']>): Promise<void> {
  await prisma.user.upsert({
    where: { id: BigInt(telegramUser.id) },
    create: {
      id: BigInt(telegramUser.id),
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      lastName: telegramUser.last_name ?? null,
      language: telegramUser.language_code ?? 'en',
    },
    update: {
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      lastName: telegramUser.last_name ?? null,
    },
  });
}

export const authMiddleware: MiddlewareFn<MidnightContext> = async (ctx, next) => {
  const user = ctx.from;
  if (!user) return next();

  if (config.telegram.allowedUserIds.length > 0) {
    const allowed = config.telegram.allowedUserIds.includes(BigInt(user.id));
    if (!allowed) {
      logger.warn(`Unauthorized access from ${user.id} (@${user.username})`);
      await ctx.reply('⛔ Access denied. This is a private assistant.');
      return;
    }
  }

  try {
    await ensureUser(user);
  } catch (err) {
    logger.error('Failed to ensure user:', err);
  }

  return next();
};

export const errorMiddleware: MiddlewareFn<MidnightContext> = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    logger.error('Unhandled bot error:', err);
    try {
      await ctx.reply('⚠️ Something went wrong. Please try again.');
    } catch {
      // ignore
    }
  }
};

export const typingMiddleware: MiddlewareFn<MidnightContext> = async (ctx, next) => {
  if (ctx.chat) {
    await ctx.sendChatAction('typing').catch(() => {});
  }
  return next();
};
