import { Memory, MemoryType } from '@prisma/client';
import { prisma } from '../database/prisma';
import { MemoryInput } from '../types';

export async function saveMemory(
  userId: bigint,
  input: MemoryInput
): Promise<Memory> {
  return prisma.memory.create({
    data: {
      userId,
      content: input.content,
      category: input.category ?? 'general',
      type: (input.type as MemoryType) ?? MemoryType.PERMANENT,
      tags: input.tags ?? [],
      expiresAt: input.expiresAt,
    },
  });
}

export async function searchMemories(
  userId: bigint,
  searchTerm?: string
): Promise<Memory[]> {
  return prisma.memory.findMany({
    where: {
      userId,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        searchTerm
          ? {
              OR: [
                { content: { contains: searchTerm, mode: 'insensitive' } },
                { category: { contains: searchTerm, mode: 'insensitive' } },
                { tags: { has: searchTerm } },
              ],
            }
          : {},
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function getAllMemories(userId: bigint): Promise<Memory[]> {
  return prisma.memory.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteMemoriesByQuery(
  userId: bigint,
  searchTerm: string
): Promise<number> {
  const memories = await searchMemories(userId, searchTerm);
  if (memories.length === 0) return 0;

  const result = await prisma.memory.deleteMany({
    where: {
      userId,
      id: { in: memories.map((m) => m.id) },
    },
  });
  return result.count;
}

export async function cleanupExpiredMemories(): Promise<void> {
  await prisma.memory.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export function formatMemoriesForDisplay(memories: Memory[]): string {
  if (memories.length === 0) return '🧠 No memories stored yet.';

  // Group by category
  const grouped = new Map<string, Memory[]>();
  for (const m of memories) {
    const cat = m.category ?? 'general';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(m);
  }

  let text = '🧠 *Your memories:*\n\n';
  for (const [cat, items] of grouped.entries()) {
    text += `*${cat.toUpperCase()}*\n`;
    for (const m of items) {
      const date = new Date(m.createdAt).toLocaleDateString('en-GB');
      text += `• ${m.content} _(${date})_\n`;
    }
    text += '\n';
  }
  return text.trim();
}
