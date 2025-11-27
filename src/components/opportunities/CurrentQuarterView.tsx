"use client";

import { useMemo, useState, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { type Opportunity } from "@/types/opportunity";
import { formatCurrencyCompact } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { getQuarterFromDate } from "@/lib/utils/quarter";
import {
  createCurrentQuarterColumns,
  DEFAULT_COLUMN_ORDER,
  COLUMN_CONFIGS,
  type CurrentQuarterColumnId,
} from "@/lib/config/current-quarter-columns";
import { ColumnVisibilityDropdown } from "./ColumnVisibilityDropdown";
import { ColumnOrderingDropdown } from "./ColumnOrderingDropdown";

interface CurrentQuarterViewProps {
  opportunities: Opportunity[];
  fiscalYearStartMonth: number;
  onOpportunityUpdate: (id: string, updates: Partial<Opportunity>) => Promise<void>;
}

export function CurrentQuarterView({
  opportunities,
  fiscalYearStartMonth,
  onOpportunityUpdate,
}: CurrentQuarterViewProps) {
  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: "closeDate", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);

  // Load column visibility from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('current-quarter-column-visibility');
      if (saved) {
        try {
          setColumnVisibility(JSON.parse(saved));
        } catch (error) {
          console.error('Failed to parse column visibility:', error);
        }
      }
    }
  }, []);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('current-quarter-column-visibility', JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  // Load column order from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('current-quarter-column-order');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate that all keys are present
          if (Array.isArray(parsed) && parsed.length === DEFAULT_COLUMN_ORDER.length) {
            setColumnOrder(parsed);
          }
        } catch (error) {
          console.error('Failed to parse column order:', error);
        }
      }
    }
  }, []);

  // Save column order to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('current-quarter-column-order', JSON.stringify(columnOrder));
    }
  }, [columnOrder]);

  // Calculate current fiscal quarter
  const currentQuarter = useMemo(() => {
    return getQuarterFromDate(new Date(), fiscalYearStartMonth);
  }, [fiscalYearStartMonth]);

  // Filter opportunities to current quarter
  const currentQuarterOpps = useMemo(() => {
    return opportunities.filter((opp) => opp.quarter === currentQuarter);
  }, [opportunities, currentQuarter]);

  // Helper function for getDaysUntilClose (used by column definition)
  const getDaysUntilClose = (closeDate: string | null | undefined) => {
    if (!closeDate) return null;
    const close = new Date(closeDate);
    const today = new Date();
    const diffTime = close.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Create TanStack Table instance
  const columns = useMemo(
    () => createCurrentQuarterColumns(onOpportunityUpdate, getDaysUntilClose),
    [onOpportunityUpdate]
  );

  const table = useReactTable({
    data: currentQuarterOpps,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalArr = currentQuarterOpps.reduce((sum, opp) => sum + opp.amountArr, 0);

    // Group by forecast category
    const forecastStats = {
      pipeline: { arr: 0, count: 0 },
      bestCase: { arr: 0, count: 0 },
      commit: { arr: 0, count: 0 },
    };

    currentQuarterOpps.forEach((opp) => {
      const category = opp.forecastCategory ?? 'pipeline';
      if (category === 'pipeline' || category === 'bestCase' || category === 'commit') {
        forecastStats[category].arr += opp.amountArr;
        forecastStats[category].count += 1;
      }
    });

    return {
      totalArr,
      count: currentQuarterOpps.length,
      forecastStats,
    };
  }, [currentQuarterOpps]);

  // Get urgency color based on days left
  const getUrgencyColor = (daysLeft: number | null) => {
    if (daysLeft === null) return "";
    if (daysLeft < 0) return "bg-red-50 dark:bg-red-950/20";
    if (daysLeft <= 7) return "bg-red-50 dark:bg-red-950/20";
    if (daysLeft <= 14) return "bg-yellow-50 dark:bg-yellow-950/20";
    return "";
  };

  return (
    <div className="space-y-4">
      {/* Column Controls */}
      <div className="flex justify-end gap-2">
        <ColumnVisibilityDropdown
          columns={columnOrder as CurrentQuarterColumnId[]}
          columnConfigs={COLUMN_CONFIGS}
          visibility={columnVisibility}
          onVisibilityChange={setColumnVisibility}
        />
        <ColumnOrderingDropdown
          columns={columnOrder}
          columnConfigs={COLUMN_CONFIGS}
          onReorder={setColumnOrder}
        />
      </div>

      {/* Forecast Category Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-slate-400">
          <div className="text-sm text-muted-foreground">Pipeline</div>
          <div className="text-2xl font-bold">
            {formatCurrencyCompact(stats.forecastStats.pipeline.arr)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.forecastStats.pipeline.count} opportunities
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-blue-500">
          <div className="text-sm text-muted-foreground">Best Case</div>
          <div className="text-2xl font-bold">
            {formatCurrencyCompact(stats.forecastStats.bestCase.arr)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.forecastStats.bestCase.count} opportunities
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-emerald-500">
          <div className="text-sm text-muted-foreground">Commit</div>
          <div className="text-2xl font-bold">
            {formatCurrencyCompact(stats.forecastStats.commit.arr)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.forecastStats.commit.count} opportunities
          </div>
        </Card>
      </div>

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total ARR</div>
          <div className="text-2xl font-bold">{formatCurrencyCompact(stats.totalArr)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Count</div>
          <div className="text-2xl font-bold">{stats.count}</div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={header.column.columnDef.meta?.className}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="text-center text-muted-foreground py-8"
                  >
                    No opportunities closing in {currentQuarter}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const daysLeft = getDaysUntilClose(row.original.closeDate);
                  const urgencyClass = getUrgencyColor(daysLeft);

                  return (
                    <TableRow key={row.id} className={urgencyClass}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cell.column.columnDef.meta?.className}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
