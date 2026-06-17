import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });
}

// Reuse client in development to avoid too many connections
export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Log slow queries
(prisma as any).$on('query', (e: { query: string; duration: number }) => {
  if (e.duration > 1000) {
    logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
  }
});

(prisma as any).$on('error', (e: { message: string }) => {
  logger.error('Prisma error:', e.message);
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('✅ PostgreSQL connected via Prisma');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
