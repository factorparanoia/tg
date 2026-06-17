import cron from 'node-cron';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { Telegraf } from 'telegraf';
import { RepeatType } from '@prisma/client';
import {
  getPendingReminders,
  markReminderSent,
  rescheduleReminder,
} from './index';
import { logger } from '../utils/logger';
import { MidnightContext } from '../types';

export function startReminderScheduler(bot: Telegraf<MidnightContext>): void {
  cron.schedule('* * * * *', async () => {
    try {
      const due = await getPendingReminders();

      for (const reminder of due) {
        try {
          await bot.telegram.sendMessage(
            Number(reminder.chatId),
            `⏰ *Reminder*\n\n${reminder.message}`,
            { parse_mode: 'Markdown' }
          );

          if (reminder.repeat === RepeatType.NONE) {
            await markReminderSent(reminder.id);
          } else {
            const base = new Date(reminder.remindAt);
            let next: Date;

            switch (reminder.repeat) {
              case RepeatType.DAILY:   next = addDays(base, 1); break;
              case RepeatType.WEEKLY:  next = addWeeks(base, 1); break;
              case RepeatType.MONTHLY: next = addMonths(base, 1); break;
              default:                 next = addDays(base, 1);
            }

            await rescheduleReminder(reminder.id, next);
          }
        } catch (err) {
          logger.error(`Failed to send reminder ${reminder.id}:`, err);
        }
      }
    } catch (err) {
      logger.error('Reminder scheduler error:', err);
    }
  });

  logger.info('⏰ Reminder scheduler started (runs every minute)');
}
