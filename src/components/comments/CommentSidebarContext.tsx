// src/components/comments/CommentSidebarContext.tsx
// Global context for managing comment sidebar state across all pages

"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface CommentSidebarContextType {
  isOpen: boolean;
  entityType: string | null;
  entityId: string | null;
  selectedCommentId: string | null;
  pageContext: string | null;
  openSidebar: (entityType: string, entityId: string, pageContext?: string) => void;
  closeSidebar: () => void;
  selectComment: (commentId: string | null) => void;
  setEntityContext: (entityType: string, entityId: string, pageContext?: string) => void;
}

const CommentSidebarContext = createContext<CommentSidebarContextType | null>(null);

interface CommentSidebarProviderProps {
  children: ReactNode;
}

export function CommentSidebarProvider({ children }: CommentSidebarProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [pageContext, setPageContext] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  const openSidebar = (type: string, id: string, context?: string) => {
    setEntityType(type);
    setEntityId(id);
    setPageContext(context || null);
    setIsOpen(true);
  };

  const closeSidebar = () => {
    setIsOpen(false);
    setSelectedCommentId(null);
  };

  const selectComment = (commentId: string | null) => {
    setSelectedCommentId(commentId);
  };

  const setEntityContext = (type: string, id: string, context?: string) => {
    setEntityType(type);
    setEntityId(id);
    setPageContext(context || null);
  };

  return (
    <CommentSidebarContext.Provider
      value={{
        isOpen,
        entityType,
        entityId,
        selectedCommentId,
        pageContext,
        openSidebar,
        closeSidebar,
        selectComment,
        setEntityContext,
      }}
    >
      {children}
    </CommentSidebarContext.Provider>
  );
}

export function useCommentSidebar() {
  const context = useContext(CommentSidebarContext);
  if (!context) {
    throw new Error("useCommentSidebar must be used within CommentSidebarProvider");
  }
  return context;
}
