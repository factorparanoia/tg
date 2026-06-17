import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { chat } from '../ai';
import { FileAnalysisResult, SupportedFileType } from '../types';
import { logger } from '../utils/logger';

const MAX_CHARS = 12000; // Truncate before sending to LLM

function detectFileType(mimeType: string, filename: string): SupportedFileType | null {
  if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) return 'pdf';
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    filename.endsWith('.docx')
  )
    return 'docx';
  if (mimeType === 'text/plain' || filename.endsWith('.txt')) return 'txt';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

async function extractText(
  buffer: Buffer,
  type: SupportedFileType,
  filename: string
): Promise<string> {
  switch (type) {
    case 'pdf': {
      const data = await pdf(buffer);
      return data.text;
    }
    case 'docx': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'txt':
      return buffer.toString('utf-8');
    case 'image':
      return `[Image file: ${filename}]`;
    default:
      return '[Unsupported file type]';
  }
}

export async function analyzeFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  userQuestion?: string
): Promise<FileAnalysisResult> {
  const type = detectFileType(mimeType, filename);
  if (!type) throw new Error(`Unsupported file type: ${mimeType}`);

  logger.info(`Analyzing file: ${filename} (${type})`);
  const text = await extractText(buffer, type, filename);
  const truncated = text.slice(0, MAX_CHARS);
  const wasTruncated = text.length > MAX_CHARS;

  const prompt = userQuestion
    ? `The user uploaded a file "${filename}" and asks: "${userQuestion}"

File contents:
${truncated}${wasTruncated ? '\n\n[Note: File was truncated due to length]' : ''}

Answer the user's question based on the file contents.`
    : `Summarize the following file "${filename}" in a clear, structured way.
Highlight: main topics, key points, important data.

File contents:
${truncated}${wasTruncated ? '\n\n[Note: File was truncated due to length]' : ''}`;

  const response = await chat([{ role: 'user', content: prompt }]);

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    type,
    filename,
    summary: response.content,
    wordCount,
  };
}
