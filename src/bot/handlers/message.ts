import { NarrowedContext, Context } from 'telegraf';
import { Update, Message } from 'telegraf/typings/core/types/typegram';
import { MidnightContext, Intent } from '../../types';
import { classifyIntent, extractMemoryDetails, answerWithContext } from '../../ai';
import { getContext, appendContext, clearContext } from '../../services/redis';
import {
  searchMemories, saveMemory, deleteMemoriesByQuery,
  formatMemoriesForDisplay, getAllMemories,
} from '../../memory';
import { saveNote, getNotes, deleteNoteByIndex, formatNotesForDisplay } from '../../notes';
import {
  createTask, getActiveTasks, completeTaskByIndex,
  deleteTaskByIndex, formatTasksForDisplay,
} from '../../tasks';
import {
  createReminder, getActiveReminders, deleteReminderByIndex,
  formatRemindersForDisplay,
} from '../../reminders';
import { calculate, formatCalcResult } from '../../calculator';
import { logger } from '../../utils/logger';
import { parse as parseDate } from 'chrono-node';
import { Priority, RepeatType } from '@prisma/client';

function parseReminderTime(timeStr: string): Date | null {
  const results = parseDate(timeStr, new Date(), { forwardDate: true });
  return results.length > 0 ? results[0].date() : null;
}

function parsePriority(raw?: string): Priority {
  const map: Record<string, Priority> = {
    low: Priority.LOW,
    medium: Priority.MEDIUM,
    high: Priority.HIGH,
    urgent: Priority.URGENT,
  };
  return map[(raw ?? '').toLowerCase()] ?? Priority.MEDIUM;
}

function extractNumber(text: string): number | null {
  const match = text.match(/\b(\d+)\b/);
  return match ? parseInt(match[1], 10) : null;
}

export async function handleMessage(
  ctx: NarrowedContext<MidnightContext, Update.MessageUpdate<Message.TextMessage>>
): Promise<void> {
  const userId = BigInt(ctx.from.id);
  const userText = ctx.message.text;

  logger.info(`[${userId}] "${userText.slice(0, 80)}"`);

  const intent = await classifyIntent(userText);
  logger.info(`Intent: ${intent.intent} (${Math.round(intent.confidence * 100)}%)`);

  const context = await getContext(userId);

  try {
    switch (intent.intent as Intent) {

      case 'remember': {
        const details = intent.entities.content
          ? {
              content: intent.entities.content,
              category: intent.entities.category ?? 'general',
              type: (intent.entities.type?.toUpperCase() as 'PERMANENT' | 'TEMPORARY') ?? 'PERMANENT',
            }
          : await extractMemoryDetails(userText);

        await saveMemory(userId, details);
        await appendContext(userId, 'user', userText);
        await appendContext(userId, 'assistant', `Remembered: ${details.content}`);
        await ctx.replyWithMarkdown(`🧠 Got it! Stored:\n_${details.content}_`);
        break;
      }

      case 'recall': {
        const query = intent.entities.query ?? userText;
        const memories = await searchMemories(userId, query);
        const response = await answerWithContext(context, memories, userText);
        await appendContext(userId, 'user', userText);
        await appendContext(userId, 'assistant', response.content);
        await ctx.replyWithMarkdown(response.content);
        break;
      }

      case 'forget': {
        const query = intent.entities.query ?? userText;
        const count = await deleteMemoriesByQuery(userId, query);
        const msg = count > 0
          ? `🗑️ Deleted ${count} memory item(s) matching "${query}".`
          : `❓ No memories found matching "${query}".`;
        await ctx.reply(msg);
        break;
      }

      case 'note_save': {
        const content = intent.entities.noteContent
          ?? userText.replace(/^(save note|note):?\s*/i, '').trim();
        const title = intent.entities.noteTitle;
        await saveNote(userId, { content, title });
        await ctx.replyWithMarkdown(`📝 Note saved${title ? `: *${title}*` : ''}!\n_${content}_`);
        break;
      }

      case 'note_list': {
        const notes = await getNotes(userId);
        await ctx.replyWithMarkdown(formatNotesForDisplay(notes));
        break;
      }

      case 'note_delete': {
        const index = intent.entities.index ?? extractNumber(userText);
        if (!index) {
          await ctx.reply('Which note? Say "delete note 2" using the number from /notes.');
          break;
        }
        const deleted = await deleteNoteByIndex(userId, index);
        await ctx.reply(deleted ? `🗑️ Note ${index} deleted.` : `❓ Note ${index} not found.`);
        break;
      }

      case 'task_create': {
        const title = intent.entities.title
          ?? userText.replace(/^(add task|task|todo):?\s*/i, '').trim();
        const priority = parsePriority(intent.entities.priority);
        const dueDate = intent.entities.due
          ? parseReminderTime(intent.entities.due) ?? undefined
          : undefined;
        const task = await createTask(userId, { title, priority, dueDate });
        await ctx.replyWithMarkdown(
          `✅ Task created:\n*${task.title}*\nPriority: ${task.priority.toLowerCase()}`
        );
        break;
      }

      case 'task_list': {
        const tasks = await getActiveTasks(userId);
        await ctx.replyWithMarkdown(formatTasksForDisplay(tasks));
        break;
      }

      case 'task_done': {
        const index = intent.entities.index ?? extractNumber(userText);
        if (!index) {
          await ctx.reply('Which task? Say "done with task 2" using the number from /tasks.');
          break;
        }
        const task = await completeTaskByIndex(userId, index);
        await ctx.reply(task ? `🎉 Task "${task.title}" marked done!` : `❓ Task ${index} not found.`);
        break;
      }

      case 'task_delete': {
        const index = intent.entities.index ?? extractNumber(userText);
        if (!index) {
          await ctx.reply('Which task? Say "delete task 2" using the number from /tasks.');
          break;
        }
        const deleted = await deleteTaskByIndex(userId, index);
        await ctx.reply(deleted ? `🗑️ Task ${index} deleted.` : `❓ Task ${index} not found.`);
        break;
      }

      case 'reminder_create': {
        const timeStr = intent.entities.time ?? userText;
        const message = intent.entities.message
          ?? userText.replace(/remind me/i, '').trim();
        const remindAt = parseReminderTime(timeStr);

        if (!remindAt) {
          await ctx.reply(
            '❓ Couldn\'t parse the time. Try: "Remind me tomorrow at 18:00 to pay internet"'
          );
          break;
        }

        const repeatRaw = (intent.entities.repeat ?? 'none').toUpperCase();
        const repeat = repeatRaw as RepeatType;
        await createReminder(userId, BigInt(ctx.chat.id), { message, remindAt, repeat });

        const formatted = remindAt.toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        await ctx.replyWithMarkdown(`⏰ Reminder set!\n*${message}*\n📅 ${formatted}`);
        break;
      }

      case 'reminder_list': {
        const reminders = await getActiveReminders(userId);
        await ctx.replyWithMarkdown(formatRemindersForDisplay(reminders));
        break;
      }

      case 'reminder_delete': {
        const index = intent.entities.index ?? extractNumber(userText);
        if (!index) {
          await ctx.reply('Which reminder? Say "delete reminder 2" using the number from /reminders.');
          break;
        }
        const deleted = await deleteReminderByIndex(userId, index);
        await ctx.reply(deleted ? `🗑️ Reminder ${index} deleted.` : `❓ Reminder ${index} not found.`);
        break;
      }

      case 'calculate': {
        const expr = intent.entities.expression ?? userText;
        const result = await calculate(expr);
        await ctx.replyWithMarkdown(formatCalcResult(result));
        break;
      }

      case 'clear_context': {
        await clearContext(userId);
        await ctx.reply('🔄 Conversation context cleared. Fresh start!');
        break;
      }

      default: {
        const memories = await getAllMemories(userId);
        const response = await answerWithContext(context, memories, userText);
        await appendContext(userId, 'user', userText);
        await appendContext(userId, 'assistant', response.content);
        await ctx.replyWithMarkdown(response.content);
        break;
      }
    }
  } catch (err) {
    logger.error('Handler error:', err);
    await ctx.reply('⚠️ Something went wrong. Please try again.');
  }
}
