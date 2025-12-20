"use client";

/**
 * MAPDocumentEditor Component
 *
 * Wrapper around the existing MAP table components for use in the Documents system.
 * Handles action items CRUD operations and syncs with parent component.
 */

import { useCallback } from "react";
import { MAPTable } from "@/components/features/opportunities/map/map-table";
import type { MAPActionItem } from "@/types/mutual-action-plan";
import type { MAPStructuredData, MAPStructuredDataLoose } from "@/types/document";

interface MAPDocumentEditorProps {
  structuredData: MAPStructuredData | MAPStructuredDataLoose | null | undefined;
  onChange: (data: MAPStructuredData) => void;
}

export function MAPDocumentEditor({
  structuredData,
  onChange,
}: MAPDocumentEditorProps) {
  // Cast action items to the proper type (they come from DB as unknown[])
  const actionItems: MAPActionItem[] = (structuredData?.actionItems || []) as MAPActionItem[];

  const handleUpdateItem = useCallback(
    (itemId: string, updates: Partial<MAPActionItem>) => {
      const updatedItems = actionItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      );
      onChange({
        ...structuredData,
        actionItems: updatedItems,
      });
    },
    [actionItems, structuredData, onChange]
  );

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      const updatedItems = actionItems.filter((item) => item.id !== itemId);
      // Re-order remaining items
      const reorderedItems = updatedItems.map((item, index) => ({
        ...item,
        order: index,
      }));
      onChange({
        ...structuredData,
        actionItems: reorderedItems,
      });
    },
    [actionItems, structuredData, onChange]
  );

  const handleAddItem = useCallback(
    (newItem: Omit<MAPActionItem, "id" | "order">) => {
      const item: MAPActionItem = {
        ...newItem,
        id: crypto.randomUUID(),
        order: actionItems.length,
      };
      onChange({
        ...structuredData,
        actionItems: [...actionItems, item],
      });
    },
    [actionItems, structuredData, onChange]
  );

  return (
    <MAPTable
      actionItems={actionItems}
      onUpdateItem={handleUpdateItem}
      onDeleteItem={handleDeleteItem}
      onAddItem={handleAddItem}
    />
  );
}
