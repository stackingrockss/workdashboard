// src/lib/errors.ts
// Centralized error logging and handling

/**
 * Log an error with context
 * In production, this should send to error tracking service (Sentry, LogRocket, etc.)
 * In development, logs to console
 */
export function logError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to error tracking service
    // Example: Sentry.captureException(error, { extra: { context, ...metadata } });

    // For now, log to console in production too (better than nothing)
    console.error(`[${context}]`, error, metadata);
  } else {
    // Development: log to console with full details
    console.error(`[${context}]`, error, metadata);
  }
}

/**
 * Log a warning with context
 */
export function logWarning(context: string, message: string, metadata?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to error tracking service
    // Example: Sentry.captureMessage(message, { level: 'warning', extra: { context, ...metadata } });

    console.warn(`[${context}]`, message, metadata);
  } else {
    console.warn(`[${context}]`, message, metadata);
  }
}

/**
 * Get a user-friendly error message from an unknown error
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (error instanceof Error && error.name === 'NetworkError') {
    return true;
  }
  return false;
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error && error.message === 'Unauthorized') {
    return true;
  }
  return false;
}
