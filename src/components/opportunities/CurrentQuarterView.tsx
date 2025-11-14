"use client";

import { useMemo, useState, useEffect } from "react";
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
import { ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { getQuarterFromDate } from "@/lib/utils/quarter";
import {
  EditableStageCell,
  EditableForecastCell,
  EditableConfidenceCell,
  EditableDateCell,
  EditableArrCell,
  EditableTextCell,
} from "./editable-cells";
import {
  ColumnVisibilityDropdown,
  type ColumnVisibility,
  DEFAULT_COLUMN_VISIBILITY,
} from "./ColumnVisibilityDropdown";

interface CurrentQuarterViewProps {
  opportunities: Opportunity[];
  fiscalYearStartMonth: number;
  onOpportunityUpdate: (id: string, updates: Partial<Opportunity>) => Promise<void>;
}

type SortField = "name" | "account" | "stage" | "forecastCategory" | "amountArr" | "confidenceLevel" | "closeDate" | "owner";
type SortDirection = "asc" | "desc";

export function CurrentQuarterView({
  opportunities,
  fiscalYearStartMonth,
  onOpportunityUpdate,
}: CurrentQuarterViewProps) {
  const [sortField, setSortField] = useState<SortField>("closeDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(DEFAULT_COLUMN_VISIBILITY);

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

  // Calculate current fiscal quarter
  const currentQuarter = useMemo(() => {
    return getQuarterFromDate(new Date(), fiscalYearStartMonth);
  }, [fiscalYearStartMonth]);

  // Filter opportunities to current quarter
  const currentQuarterOpps = useMemo(() => {
    return opportunities.filter((opp) => opp.quarter === currentQuarter);
  }, [opportunities, currentQuarter]);

  // Sort opportunities
  const sortedOpportunities = useMemo(() => {
    const sorted = [...currentQuarterOpps];
    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "account":
          aValue = a.account?.name.toLowerCase() || "";
          bValue = b.account?.name.toLowerCase() || "";
          break;
        case "stage":
          aValue = a.stage;
          bValue = b.stage;
          break;
        case "forecastCategory":
          aValue = a.forecastCategory || "";
          bValue = b.forecastCategory || "";
          break;
        case "amountArr":
          aValue = a.amountArr;
          bValue = b.amountArr;
          break;
        case "confidenceLevel":
          aValue = a.confidenceLevel;
          bValue = b.confidenceLevel;
          break;
        case "closeDate":
          aValue = a.closeDate ? new Date(a.closeDate).getTime() : 0;
          bValue = b.closeDate ? new Date(b.closeDate).getTime() : 0;
          break;
        case "owner":
          aValue = a.owner?.name.toLowerCase() || "";
          bValue = b.owner?.name.toLowerCase() || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [currentQuarterOpps, sortField, sortDirection]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalArr = currentQuarterOpps.reduce((sum, opp) => sum + opp.amountArr, 0);
    const weightedArr = currentQuarterOpps.reduce(
      (sum, opp) => sum + opp.amountArr * (opp.confidenceLevel / 5),
      0
    );
    const avgConfidence =
      currentQuarterOpps.length > 0
        ? currentQuarterOpps.reduce((sum, opp) => sum + opp.confidenceLevel, 0) /
          currentQuarterOpps.length
        : 0;
    const atRiskCount = currentQuarterOpps.filter((opp) => opp.riskNotes).length;
    const overdueCount = currentQuarterOpps.filter((opp) => {
      if (!opp.closeDate) return false;
      return new Date(opp.closeDate) < new Date();
    }).length;

    return {
      totalArr,
      weightedArr,
      count: currentQuarterOpps.length,
      avgConfidence,
      atRiskCount,
      overdueCount,
    };
  }, [currentQuarterOpps]);

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Render sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  };

  // Calculate days until close
  const getDaysUntilClose = (closeDate: string | null | undefined) => {
    if (!closeDate) return null;
    const close = new Date(closeDate);
    const today = new Date();
    const diffTime = close.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get urgency color based on days left
  const getUrgencyColor = (daysLeft: number | null) => {
    if (daysLeft === null) return "";
    if (daysLeft < 0) return "bg-red-50 dark:bg-red-950/20";
    if (daysLeft <= 7) return "bg-red-50 dark:bg-red-950/20";
    if (daysLeft <= 14) return "bg-yellow-50 dark:bg-yellow-950/20";
    return "";
  };

  // Calculate visible column count (Opportunity is always visible + conditional columns)
  const visibleColumnCount = 1 + Object.values(columnVisibility).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Column Visibility Controls */}
      <div className="flex justify-end">
        <ColumnVisibilityDropdown
          visibility={columnVisibility}
          onVisibilityChange={setColumnVisibility}
        />
      </div>

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total ARR</div>
          <div className="text-2xl font-bold">{formatCurrencyCompact(stats.totalArr)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Weighted ARR</div>
          <div className="text-2xl font-bold">{formatCurrencyCompact(stats.weightedArr)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Count</div>
          <div className="text-2xl font-bold">{stats.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Avg Confidence</div>
          <div className="text-2xl font-bold">{stats.avgConfidence.toFixed(1)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">At Risk</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
            {stats.atRiskCount}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Overdue</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-500">
            {stats.overdueCount}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("name")}
                >
                  Opportunity
                  <SortIndicator field="name" />
                </TableHead>
                {columnVisibility.account && (
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("account")}
                  >
                    Account
                    <SortIndicator field="account" />
                  </TableHead>
                )}
                {columnVisibility.owner && (
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("owner")}
                  >
                    Owner
                    <SortIndicator field="owner" />
                  </TableHead>
                )}
                {columnVisibility.stage && (
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("stage")}
                  >
                    Stage
                    <SortIndicator field="stage" />
                  </TableHead>
                )}
                {columnVisibility.forecastCategory && (
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("forecastCategory")}
                  >
                    Forecast
                    <SortIndicator field="forecastCategory" />
                  </TableHead>
                )}
                {columnVisibility.amountArr && (
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort("amountArr")}
                  >
                    ARR
                    <SortIndicator field="amountArr" />
                  </TableHead>
                )}
                {columnVisibility.confidenceLevel && (
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort("confidenceLevel")}
                  >
                    Confidence
                    <SortIndicator field="confidenceLevel" />
                  </TableHead>
                )}
                {columnVisibility.closeDate && (
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("closeDate")}
                  >
                    Close Date
                    <SortIndicator field="closeDate" />
                  </TableHead>
                )}
                {columnVisibility.daysLeft && (
                  <TableHead className="text-center">Days Left</TableHead>
                )}
                {columnVisibility.nextStep && (
                  <TableHead>Next Step</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOpportunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnCount} className="text-center text-muted-foreground py-8">
                    No opportunities closing in {currentQuarter}
                  </TableCell>
                </TableRow>
              ) : (
                sortedOpportunities.map((opp) => {
                  const daysLeft = getDaysUntilClose(opp.closeDate);
                  const urgencyClass = getUrgencyColor(daysLeft);

                  return (
                    <TableRow key={opp.id} className={urgencyClass}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {opp.riskNotes && (
                            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                          )}
                          <span className="truncate max-w-[200px]">{opp.name}</span>
                        </div>
                      </TableCell>
                      {columnVisibility.account && (
                        <TableCell>
                          <span className="truncate max-w-[150px] block">
                            {opp.account?.name || "-"}
                          </span>
                        </TableCell>
                      )}
                      {columnVisibility.owner && (
                        <TableCell>
                          <span className="truncate max-w-[120px] block">
                            {opp.owner?.name || "-"}
                          </span>
                        </TableCell>
                      )}
                      {columnVisibility.stage && (
                        <TableCell>
                          <EditableStageCell
                            value={opp.stage}
                            onSave={async (value) => {
                              await onOpportunityUpdate(opp.id, { stage: value });
                            }}
                          />
                        </TableCell>
                      )}
                      {columnVisibility.forecastCategory && (
                        <TableCell>
                          <EditableForecastCell
                            value={opp.forecastCategory ?? null}
                            onSave={async (value) => {
                              await onOpportunityUpdate(opp.id, { forecastCategory: value });
                            }}
                          />
                        </TableCell>
                      )}
                      {columnVisibility.amountArr && (
                        <TableCell className="text-right">
                          <EditableArrCell
                            value={opp.amountArr}
                            onSave={async (value) => {
                              await onOpportunityUpdate(opp.id, { amountArr: value });
                            }}
                          />
                        </TableCell>
                      )}
                      {columnVisibility.confidenceLevel && (
                        <TableCell className="text-center">
                          <EditableConfidenceCell
                            value={opp.confidenceLevel}
                            onSave={async (value) => {
                              await onOpportunityUpdate(opp.id, { confidenceLevel: value });
                            }}
                          />
                        </TableCell>
                      )}
                      {columnVisibility.closeDate && (
                        <TableCell>
                          <EditableDateCell
                            value={opp.closeDate ?? null}
                            onSave={async (value) => {
                              await onOpportunityUpdate(opp.id, { closeDate: value ?? undefined });
                            }}
                          />
                        </TableCell>
                      )}
                      {columnVisibility.daysLeft && (
                        <TableCell className="text-center">
                          {daysLeft !== null ? (
                            <span
                              className={
                                daysLeft < 0
                                  ? "text-red-600 dark:text-red-500 font-semibold"
                                  : daysLeft <= 7
                                  ? "text-red-600 dark:text-red-500"
                                  : daysLeft <= 14
                                  ? "text-yellow-600 dark:text-yellow-500"
                                  : "text-muted-foreground"
                              }
                            >
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      {columnVisibility.nextStep && (
                        <TableCell>
                          <EditableTextCell
                            value={opp.nextStep}
                            onSave={async (value) => {
                              await onOpportunityUpdate(opp.id, { nextStep: value ?? undefined });
                            }}
                            placeholder="Add next step..."
                            multiline={false}
                          />
                        </TableCell>
                      )}
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
