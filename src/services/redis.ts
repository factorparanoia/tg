import Redis from 'ioredis';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { ChatMessage } from '../types';

let redis: Redis;

export async function connectRedis(): Promise<Redis> {
  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
    lazyConnect: true,
  });

  redis.on('error', (err) => logger.error('Redis error:', err.message));
  redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await redis.connect();
  await redis.ping();
  logger.info('✅ Redis connected');
  return redis;
}

export function getRedis(): Redis {
  if (!redis) throw new Error('Redis not initialized. Call connectRedis() first.');
  return redis;
}

// ─── Conversation Context ─────────────────────────────────────────────────

const contextKey = (userId: bigint) => `ctx:${userId}`;

export async function getContext(userId: bigint): Promise<ChatMessage[]> {
  const raw = await getRedis().get(contextKey(userId));
  return raw ? JSON.parse(raw) : [];
}

export async function appendContext(
  userId: bigint,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage[]> {
  const ctx = await getContext(userId);
  ctx.push({ role, content });
  const trimmed = ctx.slice(-config.context.windowSize);
  await getRedis().setex(
    contextKey(userId),
    config.context.ttlSeconds,
    JSON.stringify(trimmed)
  );
  return trimmed;
}

export async function clearContext(userId: bigint): Promise<void> {
  await getRedis().del(contextKey(userId));
}

// ─── Generic Cache ────────────────────────────────────────────────────────

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
  await getRedis().setex(`cache:${key}`, ttlSeconds, JSON.stringify(value));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(`cache:${key}`);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function cacheDel(key: string): Promise<void> {
  await getRedis().del(`cache:${key}`);
}

// ─── Session State ────────────────────────────────────────────────────────

export async function sessionSet(userId: bigint, state: Record<string, unknown>): Promise<void> {
  await getRedis().setex(`session:${userId}`, 3600, JSON.stringify(state));
}

export async function sessionGet(userId: bigint): Promise<Record<string, unknown> | null> {
  const raw = await getRedis().get(`session:${userId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function sessionDel(userId: bigint): Promise<void> {
  await getRedis().del(`session:${userId}`);
}
