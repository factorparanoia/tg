import { Context } from 'telegraf';
import { Update, Message, User, Chat } from 'telegraf/typings/core/types/typegram';

// ─── Bot Context ──────────────────────────────────────────────────────────

export interface MidnightContext extends Context {
  // Telegraf's Context already exposes from, chat, message etc.
  // We extend only with custom session data
  session?: SessionData;
}

export interface SessionData {
  awaitingInput?: string;
  tempData?: Record<string, unknown>;
}

// ─── Intent Classification ────────────────────────────────────────────────

export type Intent =
  | 'remember'
  | 'recall'
  | 'forget'
  | 'note_save'
  | 'note_list'
  | 'note_delete'
  | 'task_create'
  | 'task_list'
  | 'task_done'
  | 'task_delete'
  | 'reminder_create'
  | 'reminder_list'
  | 'reminder_delete'
  | 'calculate'
  | 'file_analyze'
  | 'clear_context'
  | 'chat';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entities: IntentEntities;
}

export interface IntentEntities {
  content?: string;
  type?: 'permanent' | 'temporary';
  category?: string;
  query?: string;
  title?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due?: string;
  index?: number;
  message?: string;
  time?: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  noteContent?: string;
  noteTitle?: string;
  expression?: string;
}

// ─── LLM ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  content: string;
  tokens?: number;
}

// ─── Memory ───────────────────────────────────────────────────────────────

export interface MemoryInput {
  content: string;
  category?: string;
  type?: 'PERMANENT' | 'TEMPORARY';
  tags?: string[];
  expiresAt?: Date;
}

// ─── Calculator ───────────────────────────────────────────────────────────

export interface CalcResult {
  expression: string;
  result: string;
  explanation?: string;
  method: 'direct' | 'ai' | 'ai_raw';
}

// ─── File Analysis ────────────────────────────────────────────────────────

export type SupportedFileType = 'pdf' | 'docx' | 'txt' | 'image';

export interface FileAnalysisResult {
  type: SupportedFileType;
  filename: string;
  summary: string;
  wordCount?: number;
  pageCount?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────

export interface AppConfig {
  telegram: {
    token: string;
    allowedUserIds: bigint[];
  };
  openai: {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  context: {
    windowSize: number;
    ttlSeconds: number;
  };
  app: {
    port: number;
    nodeEnv: string;
    logLevel: string;
  };
  features: {
    fileAnalysis: boolean;
    webSearch: boolean;
    imageGeneration: boolean;
    voice: boolean;
  };
}
