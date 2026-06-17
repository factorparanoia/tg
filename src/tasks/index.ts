import { Task, TaskStatus, Priority } from '@prisma/client';
import { prisma } from '../database/prisma';

const PRIORITY_EMOJI: Record<Priority, string> = {
  URGENT: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🟢',
};

export async function createTask(
  userId: bigint,
  input: {
    title: string;
    description?: string;
    priority?: Priority;
    dueDate?: Date;
    tags?: string[];
  }
): Promise<Task> {
  return prisma.task.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      priority: input.priority ?? Priority.MEDIUM,
      dueDate: input.dueDate,
      tags: input.tags ?? [],
    },
  });
}

export async function getActiveTasks(userId: bigint): Promise<Task[]> {
  return prisma.task.findMany({
    where: {
      userId,
      status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
    },
    orderBy: [
      { priority: 'asc' }, // URGENT < HIGH < MEDIUM < LOW alphabetically
      { dueDate: 'asc' },
      { createdAt: 'asc' },
    ],
  });
}

export async function getTaskByIndex(userId: bigint, index: number): Promise<Task | null> {
  const tasks = await getActiveTasks(userId);
  return tasks[index - 1] ?? null;
}

export async function completeTaskByIndex(userId: bigint, index: number): Promise<Task | null> {
  const task = await getTaskByIndex(userId, index);
  if (!task) return null;

  return prisma.task.update({
    where: { id: task.id },
    data: { status: TaskStatus.DONE, completedAt: new Date() },
  });
}

export async function deleteTaskByIndex(userId: bigint, index: number): Promise<boolean> {
  const task = await getTaskByIndex(userId, index);
  if (!task) return false;
  await prisma.task.delete({ where: { id: task.id } });
  return true;
}

export function formatTasksForDisplay(tasks: Task[]): string {
  if (tasks.length === 0) return '✅ No active tasks. You\'re all caught up!';

  let text = '📋 *Your tasks:*\n\n';
  tasks.forEach((task, i) => {
    const emoji = PRIORITY_EMOJI[task.priority];
    const due = task.dueDate
      ? ` _(due ${new Date(task.dueDate).toLocaleDateString('en-GB')})_`
      : '';
    const status = task.status === TaskStatus.IN_PROGRESS ? ' 🔄' : '';
    text += `${emoji} *${i + 1}.* ${task.title}${status}${due}\n`;
  });
  return text.trim();
}

export { Priority };
