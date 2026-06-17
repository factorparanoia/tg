import http, { IncomingMessage, ServerResponse } from 'http';
import { prisma } from '../database/prisma';
import { getRedis } from './redis';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export function startHealthServer(): void {
  const server = http.createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/health' || req.url === '/') {
        try {
          await prisma.$queryRaw`SELECT 1`;
          await getRedis().ping();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            service: 'midnight-ai',
            timestamp: new Date().toISOString(),
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message }));
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    }
  );

  server.listen(config.app.port, () => {
    logger.info(`Health server on :${config.app.port}`);
  });
}
