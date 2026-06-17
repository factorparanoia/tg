import { Note } from '@prisma/client';
import { prisma } from '../database/prisma';

export async function saveNote(
  userId: bigint,
  input: { content: string; title?: string; tags?: string[] }
): Promise<Note> {
  return prisma.note.create({
    data: {
      userId,
      content: input.content,
      title: input.title,
      tags: input.tags ?? [],
    },
  });
}

export async function getNotes(userId: bigint, search?: string): Promise<Note[]> {
  return prisma.note.findMany({
    where: {
      userId,
      ...(search
        ? {
            OR: [
              { content: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getNoteByIndex(userId: bigint, index: number): Promise<Note | null> {
  const notes = await getNotes(userId);
  return notes[index - 1] ?? null; // 1-based
}

export async function deleteNoteByIndex(userId: bigint, index: number): Promise<boolean> {
  const note = await getNoteByIndex(userId, index);
  if (!note) return false;
  await prisma.note.delete({ where: { id: note.id } });
  return true;
}

export async function pinNote(noteId: string, userId: bigint, pinned = true): Promise<Note> {
  return prisma.note.update({
    where: { id: noteId, userId },
    data: { pinned },
  });
}

export function formatNotesForDisplay(notes: Note[]): string {
  if (notes.length === 0) return '📝 No notes saved yet.';

  let text = '📝 *Your notes:*\n\n';
  notes.forEach((note, i) => {
    const pin = note.pinned ? '📌 ' : '';
    const title = note.title ? `*${note.title}*\n   ` : '';
    const date = new Date(note.createdAt).toLocaleDateString('en-GB');
    text += `${pin}*${i + 1}.* ${title}${note.content} _(${date})_\n\n`;
  });
  return text.trim();
}
