import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  className?: string;
  showPageNumbers?: boolean;
  maxPageButtons?: number;
}

export function Pagination({
  pagination,
  onPageChange,
  className,
  showPageNumbers = true,
  maxPageButtons = 5,
}: PaginationProps) {
  const { page, totalPages, hasNext, hasPrev } = pagination;

  // Generate page number buttons
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];

    if (totalPages <= maxPageButtons) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const startPage = Math.max(2, page - 1);
      const endPage = Math.min(totalPages - 1, page + 1);

      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push("...");
      }

      // Add pages around current page
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push("...");
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {/* Previous buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={!hasPrev}
          className="h-8 w-8 p-0"
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="h-8 w-8 p-0"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Page numbers */}
      {showPageNumbers && (
        <div className="flex items-center gap-1">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground"
                >
                  ...
                </span>
              );
            }

            return (
              <Button
                key={pageNum}
                variant={page === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum as number)}
                className="h-8 w-8 p-0"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
      )}

      {/* Next buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="h-8 w-8 p-0"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNext}
          className="h-8 w-8 p-0"
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface PaginationInfoProps {
  pagination: PaginationMeta;
  itemName?: string;
  className?: string;
}

export function PaginationInfo({
  pagination,
  itemName = "items",
  className,
}: PaginationInfoProps) {
  const { page, limit, total } = pagination;
  const start = Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);

  if (total === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No {itemName} found
      </p>
    );
  }

  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Showing <span className="font-medium">{start}</span> to{" "}
      <span className="font-medium">{end}</span> of{" "}
      <span className="font-medium">{total}</span> {itemName}
    </p>
  );
}
