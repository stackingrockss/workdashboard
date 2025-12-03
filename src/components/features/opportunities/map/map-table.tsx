"use client";

/**
 * MAPTable Component
 *
 * Interactive table displaying action items in a spreadsheet-like format.
 * Matches the user's Google Sheet structure:
 * Target Date | Description | Status | Completion Date | Owner | Notes
 */

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { MAPActionItem } from "@/types/mutual-action-plan";
import { MAPTableRow } from "./map-table-row";
import { MAPAddRowDialog } from "./map-add-row-dialog";

// ============================================================================
// Types
// ============================================================================

interface MAPTableProps {
  actionItems: MAPActionItem[];
  onUpdateItem: (itemId: string, updates: Partial<MAPActionItem>) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: (item: Omit<MAPActionItem, "id" | "order">) => void;
}

// ============================================================================
// Component
// ============================================================================

export function MAPTable({
  actionItems,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
}: MAPTableProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Sort items by order
  const sortedItems = [...actionItems].sort((a, b) => a.order - b.order);

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Target Date</TableHead>
                <TableHead className="min-w-[250px]">Description</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead className="w-[120px]">Completion Date</TableHead>
                <TableHead className="w-[150px]">Owner</TableHead>
                <TableHead className="min-w-[150px]">Notes</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No action items yet. Click &quot;Add Row&quot; to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sortedItems.map((item) => (
                  <MAPTableRow
                    key={item.id}
                    item={item}
                    onUpdate={(updates) => onUpdateItem(item.id, updates)}
                    onDelete={() => onDeleteItem(item.id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Add Row Button */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>
        </div>
      </Card>

      <MAPAddRowDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={onAddItem}
      />
    </>
  );
}
