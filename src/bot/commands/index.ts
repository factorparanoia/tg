import { Telegraf } from 'telegraf';
import { MidnightContext } from '../../types';
import { getAllMemories, formatMemoriesForDisplay } from '../../memory';
import { getNotes, formatNotesForDisplay } from '../../notes';
import { getActiveTasks, formatTasksForDisplay } from '../../tasks';
import { getActiveReminders, formatRemindersForDisplay } from '../../reminders';
import { clearContext } from '../../services/redis';

const HELP_TEXT = `🌙 *Midnight AI* — Your personal agent

*Memory*
• \`Remember my GPU is RTX 3070\`
• \`What GPU do I have?\`
• \`What do you know about me?\`
• \`Forget my old monitor\`

*Notes*
• \`Save note: create interior design website\`
• \`Show my notes\`
• \`Delete note 2\`

*Tasks*
• \`Add task: review PR by Friday\`
• \`My tasks\`
• \`Done with task 1\`
• \`Delete task 3\`

*Reminders*
• \`Remind me tomorrow at 18:00 to pay internet\`
• \`Show reminders\`
• \`Delete reminder 1\`

*Calculator*
• \`17500 + 3200 - 500\`
• \`Calculate profit if I buy for 12000 and sell for 16500\`

*Files*
• Upload any PDF, DOCX, TXT, or image and ask questions about it

*Commands*
/start /help /memory /notes /tasks /reminders /clear`;

export function registerCommands(bot: Telegraf<MidnightContext>): void {
  bot.command('start', async (ctx) => {
    const name = ctx.from.first_name ?? 'there';
    await ctx.replyWithMarkdown(
      `🌙 *Welcome, ${name}!*\n\nI'm Midnight AI — your personal agent.\nI remember things, manage tasks, set reminders, and more.\n\nJust talk to me naturally, or use /help to see what I can do.`
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.replyWithMarkdown(HELP_TEXT);
  });

  bot.command('memory', async (ctx) => {
    const memories = await getAllMemories(BigInt(ctx.from.id));
    await ctx.replyWithMarkdown(formatMemoriesForDisplay(memories));
  });

  bot.command('notes', async (ctx) => {
    const notes = await getNotes(BigInt(ctx.from.id));
    await ctx.replyWithMarkdown(formatNotesForDisplay(notes));
  });

  bot.command('tasks', async (ctx) => {
    const tasks = await getActiveTasks(BigInt(ctx.from.id));
    await ctx.replyWithMarkdown(formatTasksForDisplay(tasks));
  });

  bot.command('reminders', async (ctx) => {
    const reminders = await getActiveReminders(BigInt(ctx.from.id));
    await ctx.replyWithMarkdown(formatRemindersForDisplay(reminders));
  });

  bot.command('clear', async (ctx) => {
    await clearContext(BigInt(ctx.from.id));
    await ctx.reply('🔄 Conversation context cleared.');
  });
}
