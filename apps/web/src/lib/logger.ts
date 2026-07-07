import pino from 'pino';
import { randomUUID } from 'crypto';

// ─── Logger Configuration ─────────────────────────────────────
//
// In production, logs are JSON structured for log aggregators.
// In development, they're pretty-printed for readability.
//
// Log levels: trace, debug, info, warn, error, fatal

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss.l',
        },
      },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
      'body.secret',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      requestId: req.requestId,
      ip: req.ip,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

// ─── Request Logger ───────────────────────────────────────────
//
// Creates a child logger scoped to a single request, automatically
// tagging all log entries with the request ID for correlation.

export interface RequestContext {
  requestId: string;
  userId?: string;
  orgId?: string;
  ip?: string;
  method?: string;
  url?: string;
}

export function createRequestLogger(context: RequestContext) {
  return logger.child(context);
}

// ─── Named Logger ─────────────────────────────────────────────
//
// Creates a child logger for a specific module or service.

export function createLogger(name: string) {
  return logger.child({ module: name });
}

// ─── Generate Request ID ──────────────────────────────────────

export function generateRequestId(): string {
  return randomUUID().slice(0, 8);
}

export default logger;
