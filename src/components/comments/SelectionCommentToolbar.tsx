// src/components/comments/SelectionCommentToolbar.tsx
// Floating toolbar that appears when text is selected to add comments

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureTextSelection, type TextSelection } from "@/lib/text-selection";

interface SelectionCommentToolbarProps {
  enabled?: boolean;
  onCommentClick: (selection: TextSelection) => void;
}

export function SelectionCommentToolbar({
  enabled = true,
  onCommentClick,
}: SelectionCommentToolbarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToolbar = useCallback(() => {
    if (!enabled) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setIsVisible(false);
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Calculate position to center toolbar above selection with bounds checking
      const toolbarWidth = 120; // Approximate width of toolbar
      const toolbarHeight = 40; // Approximate height of toolbar
      const padding = 10; // Minimum distance from viewport edge

      // Position above selection, but below if too close to top
      let top = rect.top + window.scrollY - toolbarHeight - 8;
      if (rect.top < toolbarHeight + padding) {
        // Not enough room above, position below selection
        top = rect.bottom + window.scrollY + 8;
      }

      // Center horizontally with bounds checking
      let left = rect.left + window.scrollX + rect.width / 2 - toolbarWidth / 2;
      left = Math.max(padding, Math.min(window.innerWidth - toolbarWidth - padding, left));

      setPosition({ top, left });
      setIsVisible(true);
    } catch (error) {
      console.error("Error positioning toolbar:", error);
      setIsVisible(false);
    }
  }, [enabled]);

  const hideToolbar = useCallback(() => {
    // Delay hiding to allow clicking the toolbar
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 200);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleCommentClick = useCallback(() => {
    const selection = captureTextSelection();
    if (selection) {
      onCommentClick(selection);
      setIsVisible(false);
    }
  }, [onCommentClick]);

  useEffect(() => {
    if (!enabled) return;

    const handleMouseUp = (event: MouseEvent) => {
      // Don't hide if clicking inside toolbar
      if (toolbarRef.current && toolbarRef.current.contains(event.target as Node)) {
        return;
      }

      // Show toolbar after text selection
      setTimeout(() => {
        showToolbar();
      }, 50);
    };

    const handleMouseDown = (event: MouseEvent) => {
      // Hide toolbar when clicking outside of it
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        hideToolbar();
      }
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideToolbar();
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [enabled, showToolbar, hideToolbar]);

  if (!isVisible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 rounded-lg border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseEnter={cancelHide}
      onMouseLeave={hideToolbar}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCommentClick}
        className="h-8 gap-2 text-sm"
      >
        <MessageSquare className="h-4 w-4" />
        Comment
      </Button>
    </div>
  );
}
