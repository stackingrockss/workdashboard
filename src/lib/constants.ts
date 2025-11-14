/**
 * Application-wide constants
 *
 * This file contains configuration values and magic numbers used throughout the application.
 * Centralizing these values makes the codebase more maintainable and easier to configure.
 */

// ============================================================================
// Pagination & Data Limits
// ============================================================================

export const PAGINATION = {
  OPPORTUNITIES_PER_PAGE: 100,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 1000,
} as const;

// ============================================================================
// Validation Limits
// ============================================================================

export const VALIDATION = {
  MIN_TRANSCRIPT_LENGTH: 100,
  MAX_TRANSCRIPT_LENGTH: 80000, // Safe margin below AI API limits
  MIN_ACCOUNT_NAME_LENGTH: 1,
  MAX_ACCOUNT_NAME_LENGTH: 200,
} as const;

// ============================================================================
// Polling & Background Jobs
// ============================================================================

export const POLLING = {
  PARSING_CHECK_INTERVAL_MS: 3000, // 3 seconds
  MAX_POLL_ATTEMPTS: 20,
  BACKOFF_MULTIPLIER: 1000, // Add 1s per attempt
  MAX_POLL_INTERVAL_MS: 10000, // 10 seconds max
} as const;

// ============================================================================
// AI Model Configuration
// ============================================================================

export const AI_MODELS = {
  GEMINI_DEFAULT: process.env.GEMINI_MODEL || "gemini-2.5-pro",
  GEMINI_FLASH: "gemini-2.5-flash",
} as const;

// ============================================================================
// Forecast Categories
// ============================================================================

export const FORECAST_LABELS = {
  pipeline: "Pipeline",
  bestCase: "Best Case",
  commit: "Commit",
  closedWon: "Closed Won",
  closedLost: "Closed Lost",
} as const;

export type ForecastCategory = keyof typeof FORECAST_LABELS;

// ============================================================================
// Date & Time
// ============================================================================

export const DATE_FORMATS = {
  SHORT: "MMM d, yyyy", // e.g., "Dec 31, 2024"
  LONG: "MMMM d, yyyy", // e.g., "December 31, 2024"
  ISO: "yyyy-MM-dd", // e.g., "2024-12-31"
} as const;

// ============================================================================
// Cache & Performance
// ============================================================================

export const CACHE = {
  WEB_FETCH_TTL_MS: 15 * 60 * 1000, // 15 minutes
  REVALIDATE_OPPORTUNITIES: 60, // 60 seconds
} as const;

// ============================================================================
// Security & Rate Limiting
// ============================================================================

export const RATE_LIMITS = {
  AI_CALLS_PER_HOUR: 10,
  API_CALLS_PER_MINUTE: 60,
} as const;

// ============================================================================
// Confidence Levels
// ============================================================================

export const CONFIDENCE_LEVELS = {
  MIN: 1,
  MAX: 5,
  DEFAULT: 3,
} as const;

// ============================================================================
// Priority Levels
// ============================================================================

export const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
} as const;

export type Priority = keyof typeof PRIORITY_LABELS;
