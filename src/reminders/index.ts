import { Reminder, RepeatType } from '@prisma/client';
import { prisma } from '../database/prisma';

export async function createReminder(
  userId: bigint,
  chatId: bigint,
  input: { message: string; remindAt: Date; repeat?: RepeatType }
): Promise<Reminder> {
  return prisma.reminder.create({
    data: {
      userId,
      chatId,
      message: input.message,
      remindAt: input.remindAt,
      repeat: input.repeat ?? RepeatType.NONE,
    },
  });
}

export async function getActiveReminders(userId: bigint): Promise<Reminder[]> {
  return prisma.reminder.findMany({
    where: { userId, sent: false },
    orderBy: { remindAt: 'asc' },
  });
}

export async function getPendingReminders(): Promise<Reminder[]> {
  return prisma.reminder.findMany({
    where: { sent: false, remindAt: { lte: new Date() } },
    orderBy: { remindAt: 'asc' },
    take: 100,
  });
}

export async function markReminderSent(reminderId: string): Promise<void> {
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { sent: true, sentAt: new Date() },
  });
}

export async function rescheduleReminder(reminderId: string, nextRemindAt: Date): Promise<void> {
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { remindAt: nextRemindAt, sent: false, sentAt: null },
  });
}

export async function deleteReminderByIndex(userId: bigint, index: number): Promise<boolean> {
  const reminders = await getActiveReminders(userId);
  const reminder = reminders[index - 1];
  if (!reminder) return false;
  await prisma.reminder.delete({ where: { id: reminder.id } });
  return true;
}

export function formatRemindersForDisplay(reminders: Reminder[]): string {
  if (reminders.length === 0) return '⏰ No active reminders.';

  let text = '⏰ *Your reminders:*\n\n';
  reminders.forEach((r, i) => {
    const date = new Date(r.remindAt).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const repeat = r.repeat !== RepeatType.NONE ? ` _(${r.repeat.toLowerCase()})_` : '';
    text += `*${i + 1}.* ${r.message}\n   📅 ${date}${repeat}\n\n`;
  });
  return text.trim();
}
