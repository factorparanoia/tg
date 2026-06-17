import { z } from 'zod';
import { AppConfig } from '../types';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  ALLOWED_USER_IDS: z.string().optional().default(''),

  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(4096),
  OPENAI_TEMPERATURE: z.coerce.number().default(0.7),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  CONTEXT_WINDOW_SIZE: z.coerce.number().default(20),
  CONTEXT_TTL_SECONDS: z.coerce.number().default(86400),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  PORT: z.coerce.number().default(3000),

  FEATURE_FILE_ANALYSIS: z.coerce.boolean().default(true),
  FEATURE_WEB_SEARCH: z.coerce.boolean().default(false),
  FEATURE_IMAGE_GENERATION: z.coerce.boolean().default(false),
  FEATURE_VOICE: z.coerce.boolean().default(false),
});

function parseAllowedUserIds(raw: string): bigint[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => BigInt(s));
}

function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`❌ Invalid environment configuration:\n${errors}`);
  }

  const env = parsed.data;

  return {
    telegram: {
      token: env.TELEGRAM_BOT_TOKEN,
      allowedUserIds: parseAllowedUserIds(env.ALLOWED_USER_IDS),
    },
    openai: {
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
      model: env.OPENAI_MODEL,
      maxTokens: env.OPENAI_MAX_TOKENS,
      temperature: env.OPENAI_TEMPERATURE,
    },
    database: {
      url: env.DATABASE_URL,
    },
    redis: {
      url: env.REDIS_URL,
    },
    context: {
      windowSize: env.CONTEXT_WINDOW_SIZE,
      ttlSeconds: env.CONTEXT_TTL_SECONDS,
    },
    app: {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
    },
    features: {
      fileAnalysis: env.FEATURE_FILE_ANALYSIS,
      webSearch: env.FEATURE_WEB_SEARCH,
      imageGeneration: env.FEATURE_IMAGE_GENERATION,
      voice: env.FEATURE_VOICE,
    },
  };
}

// Singleton — loaded once on startup
export const config = loadConfig();
