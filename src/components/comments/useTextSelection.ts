// src/components/comments/useTextSelection.ts
// Hook for handling text selection on a page to create inline comments

"use client";

import { useEffect, useCallback } from "react";
import { captureTextSelection, type TextSelection } from "@/lib/text-selection";
import { useCommentSidebar } from "./CommentSidebarContext";
import { toast } from "sonner";

interface UseTextSelectionOptions {
  enabled?: boolean;
  entityType: string;
  entityId: string;
  pageContext?: string;
  onSelection?: (selection: TextSelection) => void;
}

export function useTextSelection({
  enabled = true,
  entityType,
  entityId,
  pageContext,
  onSelection,
}: UseTextSelectionOptions) {
  const { openSidebar, setEntityContext } = useCommentSidebar();

  // Handle text selection
  const handleSelectionChange = useCallback(() => {
    if (!enabled) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    // Wait a bit to ensure selection is stable
    setTimeout(() => {
      const capturedSelection = captureTextSelection();
      if (capturedSelection) {
        console.log("Text selected:", capturedSelection);
      }
    }, 100);
  }, [enabled]);

  // Handle mouseup to show comment option
  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const capturedSelection = captureTextSelection();
      if (!capturedSelection) return;

      // Open sidebar with the selection
      setEntityContext(entityType, entityId, pageContext);
      openSidebar(entityType, entityId, pageContext);

      // Call custom handler if provided
      if (onSelection) {
        onSelection(capturedSelection);
      }

      // Show toast with hint
      toast.info("Text selected. Add a comment in the sidebar →", {
        duration: 2000,
      });
    },
    [enabled, entityType, entityId, pageContext, openSidebar, setEntityContext, onSelection]
  );

  // Handle keyboard shortcut (Cmd/Ctrl + Shift + C to comment)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Cmd/Ctrl + Shift + C
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "c") {
        event.preventDefault();

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          toast.error("Please select some text first");
          return;
        }

        const capturedSelection = captureTextSelection();
        if (!capturedSelection) {
          toast.error("Could not capture selection");
          return;
        }

        // Open sidebar with the selection
        setEntityContext(entityType, entityId, pageContext);
        openSidebar(entityType, entityId, pageContext);

        if (onSelection) {
          onSelection(capturedSelection);
        }

        toast.success("Ready to comment. Use the sidebar →");
      }
    },
    [enabled, entityType, entityId, pageContext, openSidebar, setEntityContext, onSelection]
  );

  useEffect(() => {
    if (!enabled) return;

    // Add event listeners
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      // Cleanup
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleMouseUp, handleKeyDown]);

  return {
    captureSelection: captureTextSelection,
  };
}
