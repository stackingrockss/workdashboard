"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserMenu } from "@/components/navigation/UserMenu";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import {
  LayoutDashboard,
  Target,
  Building2,
  FileText,
  FileStack,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
} from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Opportunities",
    href: "/opportunities",
    icon: Target,
  },
  {
    title: "Prospects",
    href: "/prospects",
    icon: Building2,
  },
  {
    title: "Content",
    href: "/content",
    icon: FileText,
  },
  {
    title: "Briefs",
    href: "/briefs",
    icon: FileStack,
  },
];

const bottomNavItems = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

interface NavItemProps {
  item: {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  isCollapsed: boolean;
  isActive: boolean;
}

function SearchButton({ isCollapsed }: { isCollapsed: boolean }) {
  const handleClick = () => {
    // Simulate Cmd+K keypress to open command palette
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  const content = (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
        "bg-sidebar-accent/50 text-sidebar-foreground/80",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isCollapsed && "justify-center px-2"
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      {!isCollapsed && (
        <>
          <span className="flex-1 text-left">Search...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Search (⌘K)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

function NavItem({ item, isCollapsed, isActive }: NavItemProps) {
  const Icon = item.icon;

  const content = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground/80",
        isCollapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
      {!isCollapsed && <span>{item.title}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.title}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, toggle, closeMobile } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "sidebar-overlay md:hidden",
          isMobileOpen && "visible"
        )}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "sidebar",
          isCollapsed && "collapsed",
          isMobileOpen && "open"
        )}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className={cn(
          "flex items-center h-14 px-4 border-b border-sidebar-border shrink-0",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isCollapsed && (
            <Link href="/dashboard" className="font-semibold text-lg text-sidebar-foreground">
              Briefcase
            </Link>
          )}

          {/* Desktop collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="hidden md:flex h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMobile}
            className="md:hidden h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search button */}
        <div className="px-3 pt-3">
          <SearchButton isCollapsed={isCollapsed} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isCollapsed={isCollapsed}
              isActive={isActive(item.href)}
            />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto p-3 border-t border-sidebar-border space-y-1">
          {bottomNavItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isCollapsed={isCollapsed}
              isActive={isActive(item.href)}
            />
          ))}

          <Separator className="my-2 bg-sidebar-border" />

          {/* Notifications and User menu */}
          <div className={cn(
            "flex items-center gap-2",
            isCollapsed ? "flex-col" : "justify-between"
          )}>
            <NotificationDropdown />
            <UserMenu />
          </div>
        </div>
      </aside>
    </>
  );
}

// Mobile menu trigger button for the header
export function MobileMenuTrigger() {
  const { openMobile } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openMobile}
      className="md:hidden h-9 w-9"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
