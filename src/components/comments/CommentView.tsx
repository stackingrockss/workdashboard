// src/components/comments/CommentView.tsx
// Main entry point component for the comment system
// Replaces direct usage of CommentHighlights with mode-aware rendering

"use client";

import { CommentHighlights } from "./CommentHighlights";
import { CommentSidebar } from "./CommentSidebar";

interface CommentViewProps {
  entityType: string;
  entityId: string;
  organizationId: string;
  pageContext?: string;
  currentUser: {
    id: string;
    role: "ADMIN" | "MANAGER" | "REP" | "VIEWER";
    organizationId: string;
  };
  organizationUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }>;
  mode?: "inline" | "sidebar" | "hybrid"; // Display mode
}

/**
 * CommentView - Unified comment system component
 *
 * Modes:
 * - inline: Shows inline popovers only (default, Google Docs style)
 * - sidebar: Shows sidebar only (original behavior)
 * - hybrid: Shows both inline popovers and sidebar
 *
 * Usage:
 * ```tsx
 * <CommentView
 *   entityType="opportunity"
 *   entityId={opportunity.id}
 *   organizationId={organizationId}
 *   currentUser={currentUser}
 *   organizationUsers={organizationUsers}
 *   mode="inline"
 * />
 * ```
 */
export function CommentView({
  entityType,
  entityId,
  organizationId,
  pageContext,
  currentUser,
  organizationUsers,
  mode = "inline", // Default to inline (Google Docs style)
}: CommentViewProps) {
  return (
    <>
      {/* Always render highlights with inline popovers/sheets */}
      {(mode === "inline" || mode === "hybrid") && (
        <CommentHighlights
          entityType={entityType}
          entityId={entityId}
          organizationId={organizationId}
          pageContext={pageContext}
          currentUser={currentUser}
          organizationUsers={organizationUsers}
        />
      )}

      {/* Render sidebar in sidebar/hybrid mode */}
      {(mode === "sidebar" || mode === "hybrid") && (
        <CommentSidebar
          currentUser={currentUser}
          organizationUsers={organizationUsers}
        />
      )}
    </>
  );
}
