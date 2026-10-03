import { Request, Response, NextFunction } from 'express';
import { logger, persistErrorLog } from './logger';
import { ZodError } from 'zod';

export interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, options?: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options?.statusCode || 500;
    this.code = options?.code || 'INTERNAL_SERVER_ERROR';
    this.details = options?.details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface ExtendedError extends Error {
  statusCode?: number;
  status?: number | string;
  code?: string;
  details?: unknown;
}

/**
 * Universal Error Handling Middleware for Express
 */
export function globalErrorHandler(
  err: ExtendedError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // If response headers have already been sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const isProd = process.env.NODE_ENV === 'production';

  // Extract client IP and user identity
  const ipAddress = typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : req.socket.remoteAddress || '0.0.0.0';

  const user = (req as Request & { user?: { id?: string; userId?: string } }).user;
  const userId = user?.id || user?.userId;

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));

    logger.warn(`[Validation Error] on ${req.method} ${req.originalUrl}`, {
      errors: formattedErrors,
      userId,
      ip: ipAddress
    });

    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'داده‌های ارسالی با استاندارد اعتبارسنجی همخوانی ندارد.',
      errors: formattedErrors
    });
  }

  // 2. JWT Authentication Error
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_EXPIRED',
      message: 'اعتبار نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.'
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'توکن دسترسی نامعتبر است.'
    });
  }

  // 3. Database / Network Connection Errors
  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    logger.error(`[Database Connection Lost] ${err.message}`, { stack: err.stack });
    return res.status(503).json({
      success: false,
      code: 'DATABASE_UNAVAILABLE',
      message: 'ارتباط با پایگاه داده موقتاً با وقفه مواجه شده است. سامانه از کش محلی استفاده می‌کند.'
    });
  }

  // Log error with Winston & persist to error_logs table/file
  logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}: ${err.message}`, {
    stack: err.stack,
    statusCode,
    userId,
    ip: ipAddress
  });

  persistErrorLog({
    endpoint: `${req.method} ${req.originalUrl}`,
    method: req.method,
    userId,
    errorMessage: err.message || 'خطای ناشناخته در سرور',
    stackTrace: err.stack,
    ipAddress
  }).catch(() => {});

  // Standard JSON response
  return res.status(statusCode).json({
    success: false,
    code: err.code || 'SERVER_ERROR',
    message: err.message || 'خطایی در پردازش درخواست شما رخ داد.',
    ...(isProd ? {} : { stack: err.stack })
  });
}
