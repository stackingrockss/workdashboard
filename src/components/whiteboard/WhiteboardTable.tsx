"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Opportunity, getStageLabel, getReviewStatusLabel, getPlatformTypeLabel, ReviewStatus, PlatformType, OpportunityStage } from "@/types/opportunity";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { updateOpportunityField } from "@/lib/api/opportunities";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { toast } from "sonner";
import {
  InlineTextInput,
  InlineTextarea,
  InlineSelect,
  InlineDatePicker,
} from "@/components/ui/inline-editable";

interface WhiteboardTableProps {
  opportunities: Opportunity[];
}

const stageOptions = [
  { value: "discovery", label: "Discovery" },
  { value: "demo", label: "Demo" },
  { value: "validateSolution", label: "Validate Solution" },
  { value: "decisionMakerApproval", label: "Decision Maker Approval" },
  { value: "contracting", label: "Contracting" },
  { value: "closedWon", label: "Closed Won" },
  { value: "closedLost", label: "Closed Lost" },
];

const confidenceLevelOptions = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

const reviewStatusOptions = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "not_applicable", label: "N/A" },
];

const platformTypeOptions = [
  { value: "oem", label: "OEM" },
  { value: "api", label: "API" },
  { value: "isv", label: "ISV" },
];

export function WhiteboardTable({ opportunities }: WhiteboardTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const router = useRouter();

  const handleFieldUpdate = async (
    opportunityId: string,
    field: keyof OpportunityUpdateInput,
    value: string | number | null
  ) => {
    try {
      await updateOpportunityField(opportunityId, field, value);
      toast.success("Updated successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
      throw error;
    }
  };

  const columns: ColumnDef<Opportunity>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-0 hover:bg-transparent"
        >
          Opportunity
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-[200px]">
          <InlineTextInput
            value={row.original.name}
            onSave={async (value) => handleFieldUpdate(row.original.id, "name", value)}
            className="font-medium"
          />
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="shrink-0"
          >
            <a href={`/opportunities/${row.original.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      ),
    },
    {
      accessorKey: "accountName",
      header: "Account",
      cell: ({ row }) => (
        <div className="min-w-[150px]">
          <InlineTextInput
            value={row.original.account?.name || row.original.accountName || ""}
            onSave={async (value) => handleFieldUpdate(row.original.id, "account", value)}
          />
        </div>
      ),
    },
    {
      accessorKey: "amountArr",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-0 hover:bg-transparent"
        >
          ARR
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[120px]">
          <InlineTextInput
            value={row.original.amountArr}
            onSave={async (value) => handleFieldUpdate(row.original.id, "amountArr", value)}
            type="number"
            min={0}
            step={1000}
            displayFormatter={(val) => formatCurrencyCompact(val as number)}
          />
        </div>
      ),
    },
    {
      accessorKey: "confidenceLevel",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-0 hover:bg-transparent"
        >
          Confidence
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[100px]">
          <InlineSelect
            value={String(row.original.confidenceLevel)}
            onSave={async (value) => handleFieldUpdate(row.original.id, "confidenceLevel", value ? parseInt(value as string) : null)}
            options={confidenceLevelOptions}
            displayFormatter={(val) => `${val}/5`}
          />
        </div>
      ),
    },
    {
      accessorKey: "stage",
      header: "Stage",
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <InlineSelect
            value={row.original.stage}
            onSave={async (value) => handleFieldUpdate(row.original.id, "stage", value)}
            options={stageOptions}
            displayFormatter={(val) => getStageLabel(val as OpportunityStage)}
          />
        </div>
      ),
    },
    {
      accessorKey: "closeDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-0 hover:bg-transparent"
        >
          Close Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[120px]">
          <InlineDatePicker
            value={row.original.closeDate}
            onSave={async (value) => handleFieldUpdate(row.original.id, "closeDate", value)}
            displayFormatter={(val) => val ? formatDateShort(val as string) : "—"}
          />
        </div>
      ),
    },
    {
      accessorKey: "decisionMakers",
      header: "Decision Makers",
      cell: ({ row }) => (
        <div className="min-w-[200px]">
          <InlineTextarea
            value={row.original.decisionMakers || ""}
            onSave={async (value) => handleFieldUpdate(row.original.id, "decisionMakers", value)}
            placeholder="Enter decision makers..."
            rows={2}
          />
        </div>
      ),
    },
    {
      accessorKey: "competition",
      header: "Competition",
      cell: ({ row }) => (
        <div className="min-w-[150px]">
          <InlineTextInput
            value={row.original.competition || ""}
            onSave={async (value) => handleFieldUpdate(row.original.id, "competition", value)}
            placeholder="Current solution..."
          />
        </div>
      ),
    },
    {
      accessorKey: "legalReviewStatus",
      header: "Legal Review",
      cell: ({ row }) => (
        <div className="min-w-[130px]">
          <InlineSelect
            value={row.original.legalReviewStatus || "not_started"}
            onSave={async (value) => handleFieldUpdate(row.original.id, "legalReviewStatus", value)}
            options={reviewStatusOptions}
            displayFormatter={(val) => getReviewStatusLabel(val as ReviewStatus)}
          />
        </div>
      ),
    },
    {
      accessorKey: "securityReviewStatus",
      header: "Security Review",
      cell: ({ row }) => (
        <div className="min-w-[140px]">
          <InlineSelect
            value={row.original.securityReviewStatus || "not_started"}
            onSave={async (value) => handleFieldUpdate(row.original.id, "securityReviewStatus", value)}
            options={reviewStatusOptions}
            displayFormatter={(val) => getReviewStatusLabel(val as ReviewStatus)}
          />
        </div>
      ),
    },
    {
      accessorKey: "platformType",
      header: "Platform",
      cell: ({ row }) => (
        <div className="min-w-[100px]">
          <InlineSelect
            value={row.original.platformType || ""}
            onSave={async (value) => handleFieldUpdate(row.original.id, "platformType", value || null)}
            options={platformTypeOptions}
            placeholder="Select..."
            displayFormatter={(val) => val ? getPlatformTypeLabel(val as PlatformType) : "—"}
          />
        </div>
      ),
    },
    {
      accessorKey: "businessCaseStatus",
      header: "Business Case",
      cell: ({ row }) => (
        <div className="min-w-[130px]">
          <InlineSelect
            value={row.original.businessCaseStatus || "not_started"}
            onSave={async (value) => handleFieldUpdate(row.original.id, "businessCaseStatus", value)}
            options={reviewStatusOptions}
            displayFormatter={(val) => getReviewStatusLabel(val as ReviewStatus)}
          />
        </div>
      ),
    },
    {
      accessorKey: "nextStep",
      header: "Next Steps",
      cell: ({ row }) => (
        <div className="min-w-[200px]">
          <InlineTextarea
            value={row.original.nextStep || ""}
            onSave={async (value) => handleFieldUpdate(row.original.id, "nextStep", value)}
            placeholder="Next action..."
            rows={2}
          />
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: opportunities,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div className="w-full overflow-auto">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No opportunities found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
