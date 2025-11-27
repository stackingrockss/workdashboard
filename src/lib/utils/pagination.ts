// src/lib/utils/pagination.ts
// Pagination utilities for opt-in API pagination

/**
 * Pagination metadata returned in API responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Default limits per endpoint (matching existing behavior or optimized for data size)
 */
export const DEFAULT_LIMITS: Record<string, number> = {
  '/api/v1/opportunities': 100,      // Match existing take: 100
  '/api/v1/accounts': 100,           // Similar volume to opportunities
  '/api/v1/comments': 50,            // Deeply nested (replies, reactions)
  '/api/v1/content': 50,             // Includes creator relation
  '/api/v1/tasks': 100,              // High-frequency polling
  '/api/v1/users': 100,              // Org-scoped
  '/api/v1/contacts': 50,            // Sub-resource
  '/api/v1/gong-calls': 25,          // Large transcript fields
};

/**
 * Detects if client wants pagination based on query parameters
 *
 * @param searchParams - URL search parameters from request
 * @returns true if page or limit params are present
 *
 * @example
 * ```typescript
 * const searchParams = req.nextUrl.searchParams;
 * if (wantsPagination(searchParams)) {
 *   // Use paginated response
 * }
 * ```
 */
export function wantsPagination(searchParams: URLSearchParams): boolean {
  return searchParams.has('page') || searchParams.has('limit');
}

/**
 * Calculates pagination metadata
 *
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @param total - Total number of items
 * @returns Pagination metadata
 *
 * @example
 * ```typescript
 * const meta = calculatePagination(1, 25, 100);
 * // { page: 1, limit: 25, total: 100, totalPages: 4, hasNext: true, hasPrev: false }
 * ```
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Builds paginated response with metadata
 *
 * @param data - Array of data items
 * @param page - Current page number
 * @param limit - Items per page
 * @param total - Total number of items
 * @param dataKey - Key name for data array in response (e.g., "opportunities")
 * @returns Response object with data and pagination metadata
 *
 * @example
 * ```typescript
 * return buildPaginatedResponse(opportunities, 1, 25, 156, 'opportunities');
 * // {
 * //   opportunities: [...],
 * //   pagination: { page: 1, limit: 25, total: 156, ... }
 * // }
 * ```
 */
export function buildPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  dataKey: string
) {
  return {
    [dataKey]: data,
    pagination: calculatePagination(page, limit, total),
  };
}

/**
 * Builds legacy response (backwards compatible, no pagination metadata)
 *
 * @param data - Array of data items
 * @param dataKey - Key name for data array in response (e.g., "opportunities")
 * @returns Response object with data only (no pagination)
 *
 * @example
 * ```typescript
 * return buildLegacyResponse(opportunities, 'opportunities');
 * // { opportunities: [...] }
 * ```
 */
export function buildLegacyResponse<T>(data: T[], dataKey: string) {
  return { [dataKey]: data };
}
