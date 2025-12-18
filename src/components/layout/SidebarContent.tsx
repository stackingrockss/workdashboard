"use client";

import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { ReactNode } from "react";

interface SidebarContentProps {
  children: ReactNode;
  className?: string;
}

export function SidebarContent({ children, className }: SidebarContentProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className={cn(
        "sidebar-content",
        isCollapsed && "sidebar-collapsed",
        className
      )}
    >
      {children}
    </div>
  );
}
