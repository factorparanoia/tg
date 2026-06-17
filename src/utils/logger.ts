import { createLogger, format, transports } from 'winston';
import { config } from './config';

export const logger = createLogger({
  level: config.app.logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    config.app.nodeEnv === 'development'
      ? format.combine(format.colorize(), format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0
            ? `\n${JSON.stringify(meta, null, 2)}`
            : '';
          return `[${timestamp}] ${level}: ${message}${metaStr}`;
        }))
      : format.json()
  ),
  transports: [new transports.Console()],
});
