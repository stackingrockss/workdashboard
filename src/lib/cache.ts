// src/lib/cache.ts
// HTTP cache control utilities for API responses

import { NextResponse } from "next/server";

/**
 * Cache strategy types
 * - immutable: Long-lived data that rarely changes (1 hour cache, 1 day stale-while-revalidate)
 * - frequent: Frequently accessed data with moderate freshness needs (60s cache with revalidation)
 * - realtime: Real-time data that should not be cached
 * - none: No caching (use for sensitive operations)
 */
export type CacheStrategy = "immutable" | "frequent" | "realtime" | "none";

/**
 * Cache control header configurations
 */
const CACHE_HEADERS: Record<CacheStrategy, string> = {
  // Immutable: Closed opportunities, historical data (1hr cache, 24hr stale)
  immutable: "public, max-age=3600, stale-while-revalidate=86400",

  // Frequent: Active opportunities, accounts (60s cache with revalidation)
  frequent: "private, max-age=60, must-revalidate",

  // Realtime: Comments, live updates (no cache, always fresh)
  realtime: "private, no-cache, must-revalidate",

  // None: Sensitive operations, auth (never cache)
  none: "no-store, no-cache, must-revalidate, max-age=0",
};

/**
 * Apply cache control headers to a NextResponse
 *
 * @param response - The NextResponse to add headers to
 * @param strategy - The caching strategy to use
 * @returns The same response with cache headers applied
 *
 * @example
 * ```typescript
 * const response = NextResponse.json({ opportunities });
 * return setCacheHeaders(response, 'frequent');
 * ```
 */
export function setCacheHeaders(
  response: NextResponse,
  strategy: CacheStrategy
): NextResponse {
  response.headers.set("Cache-Control", CACHE_HEADERS[strategy]);
  return response;
}

/**
 * Create a cached JSON response
 * Convenience function that combines NextResponse.json() with cache headers
 *
 * @param data - Data to return as JSON
 * @param strategy - Caching strategy
 * @param init - Optional response init (status, headers, etc.)
 * @returns NextResponse with cache headers
 *
 * @example
 * ```typescript
 * return cachedResponse({ accounts }, 'frequent', { status: 200 });
 * ```
 */
export function cachedResponse<T>(
  data: T,
  strategy: CacheStrategy,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(data, init);
  return setCacheHeaders(response, strategy);
}
