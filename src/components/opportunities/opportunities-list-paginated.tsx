"use client";

import { useOpportunitiesPaginated } from "@/hooks/useOpportunitiesPaginated";
import { Pagination, PaginationInfo } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OpportunityCard } from "@/components/kanban/OpportunityCard";

interface OpportunitiesListPaginatedProps {
  pageSize?: number;
}

export function OpportunitiesListPaginated({ pageSize = 50 }: OpportunitiesListPaginatedProps) {
  const {
    data: opportunities,
    pagination,
    loading,
    error,
    setPage,
    hasData,
  } = useOpportunitiesPaginated({ pageSize });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (loading && !hasData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasData && !loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <h3 className="text-lg font-semibold">No opportunities found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by creating your first opportunity
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pagination info */}
      {pagination && (
        <div className="flex items-center justify-between">
          <PaginationInfo pagination={pagination} itemName="opportunities" />
        </div>
      )}

      {/* Opportunities grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            onClick={(id) => {
              window.location.href = `/opportunities/${id}`;
            }}
          />
        ))}
      </div>

      {/* Loading overlay while fetching next page */}
      {loading && hasData && (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      )}

      {/* Pagination controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <Pagination pagination={pagination} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
