// src/lib/validations/pagination.ts
// Zod schemas for validating pagination query parameters

import { z } from 'zod';

/**
 * Pagination query parameters schema
 *
 * Validates and coerces URL query parameters for pagination.
 * Both parameters are optional to support backwards compatibility.
 *
 * @example
 * ```typescript
 * const { page, limit } = paginationQuerySchema.parse({
 *   page: searchParams.get('page'),
 *   limit: searchParams.get('limit'),
 * });
 * ```
 */
export const paginationQuerySchema = z.object({
  /**
   * Page number (1-indexed)
   * - Automatically coerced from string to number
   * - Must be a positive integer
   * - Defaults to 1 if not provided
   */
  page: z.coerce.number().int().min(1).optional().default(1),

  /**
   * Items per page
   * - Automatically coerced from string to number
   * - Must be a positive integer
   * - Maximum of 500 items per page (performance limit)
   * - No default (endpoint-specific defaults applied in route handlers)
   */
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/**
 * TypeScript type for validated pagination query parameters
 */
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
