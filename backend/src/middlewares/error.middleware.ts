import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { ApiResponse } from '@lifesynch/shared';

export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: unknown;

  constructor(message: string, statusCode = 500, code?: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Maps internal error codes to safe, user-facing messages.
 * Internal technical details are NEVER sent to the client.
 */
function getUserFacingMessage(err: AppError): string {
  switch (err.code) {
    case 'GOOGLE_AUTH_EXPIRED':
    case 'GOOGLE_ACCESS_TOKEN_MISSING':
      return 'Your Google session has expired. Please sign in again.';
    case 'GOOGLE_ACCOUNT_NOT_CONNECTED':
      return 'No Google account is connected. Please sign in with Google.';
    case 'GMAIL_API_ERROR':
      return 'Gmail could not be accessed right now. Please try again later.';
    case 'CALENDAR_API_ERROR':
      return 'Google Calendar could not be accessed right now. Please try again later.';
    case 'AI_PROCESSING_ERROR':
    case 'LLM_API_ERROR':
    case 'LLM_EMPTY_RESPONSE':
    case 'LLM_PARSE_ERROR':
    case 'LLM_SCHEMA_INVALID':
    case 'LLM_CONFIG_MISSING':
      return "We couldn't generate responsibilities right now. Your existing responsibilities are still available.";
    case 'REMINDER_GENERATION_ERROR':
      return 'Reminder generation is temporarily unavailable. Existing reminders are still active.';
    default:
      break;
  }

  // Auth errors
  if (err.statusCode === 401) {
    if (err.message.toLowerCase().includes('expired')) {
      return 'Your Google session has expired. Please sign in again.';
    }
    return 'Authentication required. Please sign in.';
  }

  // Safe fallback — never expose internal details
  if (err.statusCode >= 500) {
    return 'Something went wrong on our end. Please try again later.';
  }

  return err.message;
}

export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // Always log full details server-side only
  logger.error(`Error [${req.method} ${req.url}]: ${err.message}`, {
    stack: err.stack,
    ...(err instanceof AppError ? { code: err.code, statusCode: err.statusCode } : {})
  });

  const timestamp = new Date().toISOString();

  // Zod validation errors
  if (err instanceof ZodError) {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid request. Please check your input.',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload or parameters'
      },
      timestamp
    };
    res.status(400).json(response);
    return;
  }

  // Operational app errors — translate to user-safe message
  if (err instanceof AppError) {
    const userMessage = getUserFacingMessage(err);
    const response: ApiResponse = {
      success: false,
      message: userMessage,
      error: {
        code: err.code || 'APP_ERROR',
        message: userMessage
        // details intentionally omitted — never expose internal fields
      },
      timestamp
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown / unexpected errors — never expose stack or raw message in production
  const response: ApiResponse = {
    success: false,
    message: 'Something went wrong. Please try again later.',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    },
    timestamp
  };
  res.status(500).json(response);
};
