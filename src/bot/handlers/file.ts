import axios from 'axios';
import { NarrowedContext } from 'telegraf';
import { Update, Message } from 'telegraf/typings/core/types/typegram';
import { MidnightContext } from '../../types';
import { analyzeFile } from '../../files';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';

async function downloadFile(fileId: string, ctx: MidnightContext): Promise<Buffer> {
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await axios.get<ArrayBuffer>(fileLink.href, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

export async function handleDocument(
  ctx: NarrowedContext<MidnightContext, Update.MessageUpdate<Message.DocumentMessage>>
): Promise<void> {
  if (!config.features.fileAnalysis) {
    await ctx.reply('📄 File analysis is not enabled.');
    return;
  }

  const doc = ctx.message.document;
  const maxBytes = parseInt(process.env['MAX_FILE_SIZE_MB'] ?? '20') * 1024 * 1024;

  if (doc.file_size && doc.file_size > maxBytes) {
    await ctx.reply(`⚠️ File too large. Max size: ${process.env['MAX_FILE_SIZE_MB'] ?? 20}MB.`);
    return;
  }

  const userQuestion = ctx.message.caption ?? undefined;
  await ctx.reply('📄 Analyzing your file...');

  try {
    const buffer = await downloadFile(doc.file_id, ctx);
    const result = await analyzeFile(
      buffer,
      doc.file_name ?? 'document',
      doc.mime_type ?? 'application/octet-stream',
      userQuestion
    );
    await ctx.replyWithMarkdown(
      `📄 *${result.filename}*\n_(${result.wordCount?.toLocaleString()} words)_\n\n${result.summary}`
    );
  } catch (err) {
    logger.error('File analysis error:', err);
    await ctx.reply('⚠️ Could not analyze this file. Supported: PDF, DOCX, TXT, images.');
  }
}

export async function handlePhoto(
  ctx: NarrowedContext<MidnightContext, Update.MessageUpdate<Message.PhotoMessage>>
): Promise<void> {
  if (!config.features.fileAnalysis) return;

  const photos = ctx.message.photo;
  const largest = photos[photos.length - 1];
  const userQuestion = ctx.message.caption ?? undefined;

  await ctx.reply('🖼️ Analyzing your image...');

  try {
    const buffer = await downloadFile(largest.file_id, ctx);
    const result = await analyzeFile(buffer, 'image.jpg', 'image/jpeg', userQuestion);
    await ctx.replyWithMarkdown(`🖼️ *Image Analysis*\n\n${result.summary}`);
  } catch (err) {
    logger.error('Photo analysis error:', err);
    await ctx.reply('⚠️ Could not analyze this image.');
  }
}
