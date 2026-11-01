type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

const formatTimestamp = () => new Date().toISOString();

const SENSITIVE_KEY_REGEX = /^(access_?token|refresh_?token|token|password|secret|client_?secret|api_?key|key|auth|authorization|bearer|jwt|service_?role_?key|private_?key)$/i;

const STRING_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Google OAuth access tokens (ya29.xxx)
  { pattern: /ya29\.[a-zA-Z0-9_\-]+/g, replacement: '[REDACTED_GOOGLE_ACCESS_TOKEN]' },
  // Google OAuth refresh tokens (1//xxx)
  { pattern: /1\/\/[a-zA-Z0-9_\-]+/g, replacement: '[REDACTED_GOOGLE_REFRESH_TOKEN]' },
  // Bearer tokens in headers or strings
  { pattern: /Bearer\s+[a-zA-Z0-9_\-\.]+/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  // JWT tokens (eyJ...)
  { pattern: /eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]*/g, replacement: '[REDACTED_JWT]' },
  // Sensitive query parameters
  { pattern: /([?&](?:access_token|refresh_token|token|key|secret|password)=)[^&\s]+/gi, replacement: '$1[REDACTED]' }
];

export function sanitizeLogData(item: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH]';
  if (item === null || item === undefined) return item;

  if (typeof item === 'string') {
    let sanitized = item;
    for (const { pattern, replacement } of STRING_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    return sanitized;
  }

  if (typeof item === 'number' || typeof item === 'boolean') {
    return item;
  }

  if (item instanceof Error) {
    const sanitizedError = new Error(sanitizeLogData(item.message, depth + 1) as string);
    sanitizedError.name = item.name;
    if (item.stack) {
      sanitizedError.stack = sanitizeLogData(item.stack, depth + 1) as string;
    }
    return sanitizedError;
  }

  if (Array.isArray(item)) {
    return item.map(el => sanitizeLogData(el, depth + 1));
  }

  if (typeof item === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(item)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeLogData(val, depth + 1);
      }
    }
    return sanitizedObj;
  }

  return item;
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.debug) {
      const sanitizedMsg = sanitizeLogData(message) as string;
      const sanitizedArgs = args.map(a => sanitizeLogData(a));
      console.debug(`[\x1b[90m${formatTimestamp()}\x1b[0m] [\x1b[35mDEBUG\x1b[0m]: ${sanitizedMsg}`, ...sanitizedArgs);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.info) {
      const sanitizedMsg = sanitizeLogData(message) as string;
      const sanitizedArgs = args.map(a => sanitizeLogData(a));
      console.info(`[\x1b[90m${formatTimestamp()}\x1b[0m] [\x1b[36mINFO\x1b[0m]: ${sanitizedMsg}`, ...sanitizedArgs);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.warn) {
      const sanitizedMsg = sanitizeLogData(message) as string;
      const sanitizedArgs = args.map(a => sanitizeLogData(a));
      console.warn(`[\x1b[90m${formatTimestamp()}\x1b[0m] [\x1b[33mWARN\x1b[0m]: ${sanitizedMsg}`, ...sanitizedArgs);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.error) {
      const sanitizedMsg = sanitizeLogData(message) as string;
      const sanitizedArgs = args.map(a => sanitizeLogData(a));
      console.error(`[\x1b[90m${formatTimestamp()}\x1b[0m] [\x1b[31mERROR\x1b[0m]: ${sanitizedMsg}`, ...sanitizedArgs);
    }
  }
};

