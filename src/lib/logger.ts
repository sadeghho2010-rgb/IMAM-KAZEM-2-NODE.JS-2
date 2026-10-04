import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'madrasah-backend' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB max size per log file
      maxFiles: 5, // Keep up to 5 rotated files, automatic deletion of oldest
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB max size per log file
      maxFiles: 5, // Keep up to 5 rotated files, automatic deletion of oldest
      tailable: true,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `[${timestamp}] ${level}: ${message} ${stack ? '\n' + stack : ''} ${metaStr}`;
        })
      ),
    }),
  ],
});

/**
 * Express Request Logger Middleware
 */
export function requestLogger(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);
  req.requestId = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message, { requestId, ip: req.ip, duration });
    } else if (res.statusCode >= 400) {
      logger.warn(message, { requestId, ip: req.ip, duration });
    } else {
      logger.info(message, { requestId, duration });
    }
  });

  next();
}

/**
 * Persist critical errors to the database `error_logs` table (or local storage fallback)
 */
export async function persistErrorLog(params: {
  endpoint?: string;
  method?: string;
  userId?: string;
  errorMessage: string;
  stackTrace?: string;
  ipAddress?: string;
}) {
  const { endpoint, method, userId, errorMessage, stackTrace, ipAddress } = params;
  const id = 'err_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const logEntry = {
    id,
    endpoint,
    method,
    userId,
    errorMessage,
    stackTrace,
    ipAddress,
    createdAt: new Date().toISOString(),
  };

  try {
    // Attempt saving to database or fallback file
    const errorFile = path.join(logDir, 'database_error_logs.json');
    let existing: any[] = [];
    if (fs.existsSync(errorFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(errorFile, 'utf-8'));
      } catch (e) {
        existing = [];
      }
    }
    existing.unshift(logEntry);
    if (existing.length > 500) existing = existing.slice(0, 500);
    fs.writeFileSync(errorFile, JSON.stringify(existing, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to persist error log entry', { err });
  }
}
