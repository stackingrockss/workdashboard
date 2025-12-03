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
import {
  createQuarterlyListColumns,
  DEFAULT_QUARTERLY_COLUMN_ORDER,
  QUARTERLY_COLUMN_CONFIGS,
} from "@/lib/config/quarterly-list-columns";
import { ColumnVisibilityDropdown } from "./ColumnVisibilityDropdown";
import { ColumnOrderingDropdown } from "./ColumnOrderingDropdown";

interface QuarterlyListViewProps {
  opportunities: Opportunity[];
  fiscalYearStartMonth: number;
  onOpportunityUpdate: (id: string, updates: Partial<Opportunity>) => Promise<void>;
}

export function QuarterlyListView({
  opportunities,
  fiscalYearStartMonth,
  onOpportunityUpdate,
}: QuarterlyListViewProps) {
  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: "quarter", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_QUARTERLY_COLUMN_ORDER);

  // Load column visibility from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quarterly-list-column-visibility');
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
      localStorage.setItem('quarterly-list-column-visibility', JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  // Load column order from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quarterly-list-column-order');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate that all keys are present
          if (Array.isArray(parsed) && parsed.length === DEFAULT_QUARTERLY_COLUMN_ORDER.length) {
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
      localStorage.setItem('quarterly-list-column-order', JSON.stringify(columnOrder));
    }
  }, [columnOrder]);

  // Filter to open opportunities only (exclude closedWon and closedLost)
  const openOpportunities = useMemo(() => {
    return opportunities.filter(
      (opp) =>
        opp.stage !== "closedWon" &&
        opp.stage !== "closedLost"
    );
  }, [opportunities]);

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
    () => createQuarterlyListColumns(onOpportunityUpdate, getDaysUntilClose),
    [onOpportunityUpdate]
  );

  const table = useReactTable({
    data: openOpportunities,
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

  // Calculate summary stats by quarter
  const stats = useMemo(() => {
    const totalArr = openOpportunities.reduce((sum, opp) => sum + opp.amountArr, 0);

    // Group by quarter
    const quarterStats: Record<string, { arr: number; count: number }> = {};
    openOpportunities.forEach((opp) => {
      const quarter = opp.quarter || "Unassigned";
      if (!quarterStats[quarter]) {
        quarterStats[quarter] = { arr: 0, count: 0 };
      }
      quarterStats[quarter].arr += opp.amountArr;
      quarterStats[quarter].count += 1;
    });

    // Sort quarters
    const sortedQuarters = Object.keys(quarterStats).sort((a, b) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });

    return {
      totalArr,
      count: openOpportunities.length,
      quarterStats,
      sortedQuarters,
    };
  }, [openOpportunities]);

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
          columns={columnOrder}
          columnConfigs={QUARTERLY_COLUMN_CONFIGS}
          visibility={columnVisibility}
          onVisibilityChange={setColumnVisibility}
        />
        <ColumnOrderingDropdown
          columns={columnOrder}
          columnConfigs={QUARTERLY_COLUMN_CONFIGS}
          onReorder={setColumnOrder}
        />
      </div>

      {/* Summary Stats */}
      <Card className="p-3">
        <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
          {stats.sortedQuarters.slice(0, 4).map((quarter, index) => (
            <span key={quarter} className="flex items-center gap-1">
              {index > 0 && <span className="text-muted-foreground mx-1">|</span>}
              <span className="font-medium text-slate-600 dark:text-slate-400">{quarter}:</span>
              <span className="font-semibold">{formatCurrencyCompact(stats.quarterStats[quarter].arr)}</span>
              <span className="text-muted-foreground">
                ({stats.quarterStats[quarter].count} {stats.quarterStats[quarter].count === 1 ? 'opp' : 'opps'})
              </span>
            </span>
          ))}

          <span className="text-muted-foreground mx-1">|</span>

          <span className="font-medium">Total:</span>
          <span className="font-bold text-lg">{formatCurrencyCompact(stats.totalArr)}</span>
          <span className="text-muted-foreground">({stats.count} {stats.count === 1 ? 'opportunity' : 'opportunities'})</span>
        </div>
      </Card>

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
                    No open opportunities found
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
