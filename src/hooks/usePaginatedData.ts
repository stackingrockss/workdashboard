"use client";

import { useState, useEffect, useCallback } from "react";
import { PaginationMeta } from "@/components/ui/pagination";

interface UsePaginatedDataOptions<T> {
  fetchFn: (page: number, limit: number) => Promise<{ data: T[]; pagination: PaginationMeta }>;
  initialPage?: number;
  pageSize?: number;
  enabled?: boolean;
}

interface UsePaginatedDataResult<T> {
  data: T[];
  pagination: PaginationMeta | null;
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  refetch: () => Promise<void>;
  hasData: boolean;
}

export function usePaginatedData<T>({
  fetchFn,
  initialPage = 1,
  pageSize = 50,
  enabled = true,
}: UsePaginatedDataOptions<T>): UsePaginatedDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn(page, pageSize);
      setData(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setData([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, page, pageSize, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSetPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  return {
    data,
    pagination,
    loading,
    error,
    page,
    setPage: handleSetPage,
    refetch: fetchData,
    hasData: data.length > 0,
  };
}
