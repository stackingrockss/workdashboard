"use client";

import { useCallback } from "react";
import { usePaginatedData } from "./usePaginatedData";
import { getOpportunities } from "@/lib/api/opportunities";
import { Opportunity } from "@/types/opportunity";

interface UseOpportunitiesPaginatedOptions {
  initialPage?: number;
  pageSize?: number;
  enabled?: boolean;
}

export function useOpportunitiesPaginated({
  initialPage = 1,
  pageSize = 50,
  enabled = true,
}: UseOpportunitiesPaginatedOptions = {}) {
  const fetchOpportunities = useCallback(
    async (page: number, limit: number) => {
      const response = await getOpportunities({ page, limit });

      // Handle both paginated and legacy responses
      if (response.pagination) {
        // Paginated response
        return {
          data: response.opportunities,
          pagination: response.pagination,
        };
      } else {
        // Legacy response - create pagination metadata
        const total = response.opportunities.length;
        return {
          data: response.opportunities,
          pagination: {
            page: 1,
            limit: total,
            total,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
    },
    []
  );

  return usePaginatedData<Opportunity>({
    fetchFn: fetchOpportunities,
    initialPage,
    pageSize,
    enabled,
  });
}
