import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Opportunity } from "@/types/opportunity";
import {
  EditableStageCell,
  EditableForecastCell,
  EditableConfidenceCell,
  EditableDateCell,
  EditableArrCell,
  EditableTextCell,
} from "@/components/opportunities/editable-cells";

// Extend TanStack Table's ColumnMeta to include className
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
  }
}

/**
 * Column identifiers for Current Quarter table view
 */
export type CurrentQuarterColumnId =
  | "name"
  | "account"
  | "owner"
  | "stage"
  | "forecastCategory"
  | "amountArr"
  | "confidenceLevel"
  | "closeDate"
  | "daysLeft"
  | "nextStep";

/**
 * Metadata configuration for each column
 */
export interface ColumnConfig {
  id: CurrentQuarterColumnId;
  label: string;
  defaultVisible: boolean;
  sortable: boolean;
  align?: "left" | "right" | "center";
}

/**
 * Column metadata configuration
 */
export const COLUMN_CONFIGS: Record<CurrentQuarterColumnId, ColumnConfig> = {
  name: {
    id: "name",
    label: "Opportunity",
    defaultVisible: true,
    sortable: true,
    align: "left",
  },
  account: {
    id: "account",
    label: "Account",
    defaultVisible: true,
    sortable: true,
    align: "left",
  },
  owner: {
    id: "owner",
    label: "Owner",
    defaultVisible: true,
    sortable: true,
    align: "left",
  },
  stage: {
    id: "stage",
    label: "Stage",
    defaultVisible: true,
    sortable: true,
    align: "left",
  },
  forecastCategory: {
    id: "forecastCategory",
    label: "Forecast",
    defaultVisible: true,
    sortable: true,
    align: "left",
  },
  amountArr: {
    id: "amountArr",
    label: "ARR",
    defaultVisible: true,
    sortable: true,
    align: "right",
  },
  confidenceLevel: {
    id: "confidenceLevel",
    label: "Confidence",
    defaultVisible: true,
    sortable: true,
    align: "center",
  },
  closeDate: {
    id: "closeDate",
    label: "Close Date",
    defaultVisible: true,
    sortable: true,
    align: "left",
  },
  daysLeft: {
    id: "daysLeft",
    label: "Days Left",
    defaultVisible: true,
    sortable: false,
    align: "center",
  },
  nextStep: {
    id: "nextStep",
    label: "Next Step",
    defaultVisible: true,
    sortable: false,
    align: "left",
  },
};

/**
 * Default column order
 */
export const DEFAULT_COLUMN_ORDER: CurrentQuarterColumnId[] = [
  "name",
  "account",
  "owner",
  "stage",
  "forecastCategory",
  "amountArr",
  "confidenceLevel",
  "closeDate",
  "daysLeft",
  "nextStep",
];

/**
 * Factory function to create TanStack Table column definitions
 */
export function createCurrentQuarterColumns(
  onOpportunityUpdate: (id: string, updates: Partial<Opportunity>) => Promise<void>,
  getDaysUntilClose: (closeDate: string | null | undefined) => number | null
): ColumnDef<Opportunity>[] {
  return [
    // Opportunity Name Column
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-2 hover:bg-muted/50"
        >
          Opportunity
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.riskNotes && (
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
          )}
          <Link
            href={`/opportunities/${row.original.id}`}
            className="truncate max-w-[200px] font-medium text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        </div>
      ),
      meta: {
        className: "",
      },
    },

    // Account Column
    {
      id: "account",
      accessorFn: (row) => row.account?.name || "",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-2 hover:bg-muted/50"
        >
          Account
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const accountName = row.original.account?.name;

        if (!accountName) {
          return <span className="text-muted-foreground">-</span>;
        }

        return (
          <Link
            href={`/opportunities/${row.original.id}`}
            className="truncate max-w-[150px] block text-primary hover:underline"
          >
            {accountName}
          </Link>
        );
      },
      meta: {
        className: "",
      },
    },

    // Owner Column
    {
      id: "owner",
      accessorFn: (row) => row.owner?.name || "",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-2 hover:bg-muted/50"
        >
          Owner
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="truncate max-w-[120px] block">{row.original.owner?.name || "-"}</span>
      ),
      meta: {
        className: "",
      },
    },

    // Stage Column
    {
      id: "stage",
      accessorKey: "stage",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-2 hover:bg-muted/50"
        >
          Stage
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableStageCell
          value={row.original.stage}
          onSave={async (value) => {
            await onOpportunityUpdate(row.original.id, { stage: value });
          }}
        />
      ),
      meta: {
        className: "",
      },
    },

    // Forecast Category Column
    {
      id: "forecastCategory",
      accessorKey: "forecastCategory",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-2 hover:bg-muted/50"
        >
          Forecast
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableForecastCell
          value={row.original.forecastCategory ?? null}
          onSave={async (value) => {
            await onOpportunityUpdate(row.original.id, { forecastCategory: value });
          }}
        />
      ),
      meta: {
        className: "",
      },
    },

    // ARR Column
    {
      id: "amountArr",
      accessorKey: "amountArr",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-2 hover:bg-muted/50 justify-end w-full"
        >
          ARR
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableArrCell
          value={row.original.amountArr}
          onSave={async (value) => {
            await onOpportunityUpdate(row.original.id, { amountArr: value });
          }}
        />
      ),
      meta: {
        className: "text-right",
      },
    },

    // Confidence Level Column
    {
      id: "confidenceLevel",
      accessorKey: "confidenceLevel",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-2 hover:bg-muted/50 justify-center w-full"
        >
          Confidence
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableConfidenceCell
          value={row.original.confidenceLevel}
          onSave={async (value) => {
            await onOpportunityUpdate(row.original.id, { confidenceLevel: value });
          }}
        />
      ),
      meta: {
        className: "text-center",
      },
    },

    // Close Date Column
    {
      id: "closeDate",
      accessorKey: "closeDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 p-2 hover:bg-muted/50"
        >
          Close Date
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableDateCell
          value={row.original.closeDate ?? null}
          onSave={async (value) => {
            await onOpportunityUpdate(row.original.id, { closeDate: value ?? undefined });
          }}
        />
      ),
      meta: {
        className: "",
      },
    },

    // Days Left Column
    {
      id: "daysLeft",
      accessorFn: (row) => getDaysUntilClose(row.closeDate),
      header: () => <div className="text-center">Days Left</div>,
      cell: ({ row }) => {
        const daysLeft = getDaysUntilClose(row.original.closeDate);
        return daysLeft !== null ? (
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
        );
      },
      meta: {
        className: "text-center",
      },
    },

    // Next Step Column
    {
      id: "nextStep",
      accessorKey: "nextStep",
      header: () => <div>Next Step</div>,
      cell: ({ row }) => (
        <EditableTextCell
          value={row.original.nextStep}
          onSave={async (value) => {
            await onOpportunityUpdate(row.original.id, { nextStep: value ?? undefined });
          }}
          placeholder="Add next step..."
          multiline={false}
        />
      ),
      meta: {
        className: "",
      },
    },
  ];
}
