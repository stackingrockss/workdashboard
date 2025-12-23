"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  Target,
  FileText,
  Settings,
  PlusCircle,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrencyCompact } from "@/lib/format";

interface SearchResult {
  opportunities: Array<{
    id: string;
    name: string;
    accountName?: string;
    amountArr: number;
    stage: string;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    industry?: string;
  }>;
}

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult>({
    opportunities: [],
    accounts: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const debouncedSearch = useDebounce(search, 300);

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search for results when debounced search changes
  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setResults({ opportunities: [], accounts: [] });
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/v1/search?q=${encodeURIComponent(debouncedSearch)}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedSearch]);

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      setSearch("");
      command();
    },
    []
  );

  const navigateTo = useCallback(
    (path: string) => {
      runCommand(() => router.push(path));
    },
    [router, runCommand]
  );

  // Navigation items
  const navigationItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/dashboard",
      shortcut: "D",
    },
    {
      icon: Target,
      label: "Opportunities",
      path: "/opportunities",
      shortcut: "O",
    },
    {
      icon: Building2,
      label: "Prospects",
      path: "/prospects",
      shortcut: "P",
    },
    {
      icon: FileText,
      label: "Briefs",
      path: "/briefs",
      shortcut: "B",
    },
    {
      icon: Settings,
      label: "Settings",
      path: "/settings",
      shortcut: "S",
    },
  ];

  // Quick actions
  const quickActions = [
    {
      icon: PlusCircle,
      label: "New Opportunity",
      action: () => router.push("/opportunities?new=true"),
    },
    {
      icon: PlusCircle,
      label: "New Brief",
      action: () => router.push("/briefs/new"),
    },
  ];

  const hasSearchResults =
    results.opportunities.length > 0 || results.accounts.length > 0;
  const showNavigation = !debouncedSearch || debouncedSearch.length < 2;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search opportunities, accounts, or navigate the app"
    >
      <CommandInput
        placeholder="Search opportunities, accounts, or type a command..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Searching..." : "No results found."}
        </CommandEmpty>

        {/* Search Results - Opportunities */}
        {results.opportunities.length > 0 && (
          <CommandGroup heading="Opportunities">
            {results.opportunities.map((opp) => (
              <CommandItem
                key={opp.id}
                value={`opportunity-${opp.id}-${opp.name}`}
                onSelect={() => navigateTo(`/opportunities/${opp.id}`)}
              >
                <Target className="mr-2 h-4 w-4 text-blue-500" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="truncate">{opp.name}</span>
                  {opp.accountName && (
                    <span className="text-xs text-muted-foreground truncate">
                      {opp.accountName}
                    </span>
                  )}
                </div>
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatCurrencyCompact(opp.amountArr)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Search Results - Accounts */}
        {results.accounts.length > 0 && (
          <CommandGroup heading="Accounts">
            {results.accounts.map((account) => (
              <CommandItem
                key={account.id}
                value={`account-${account.id}-${account.name}`}
                onSelect={() => navigateTo(`/prospects/${account.id}`)}
              >
                <Building2 className="mr-2 h-4 w-4 text-purple-500" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="truncate">{account.name}</span>
                  {account.industry && (
                    <span className="text-xs text-muted-foreground truncate">
                      {account.industry}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Show separator if we have search results and will show navigation */}
        {hasSearchResults && showNavigation && <CommandSeparator />}

        {/* Navigation - always show when not actively searching */}
        {showNavigation && (
          <>
            <CommandGroup heading="Navigation">
              {navigationItems.map((item) => (
                <CommandItem
                  key={item.path}
                  value={`nav-${item.label}`}
                  onSelect={() => navigateTo(item.path)}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  <CommandShortcut>⌘{item.shortcut}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Quick Actions">
              {quickActions.map((action) => (
                <CommandItem
                  key={action.label}
                  value={`action-${action.label}`}
                  onSelect={() => runCommand(action.action)}
                >
                  <action.icon className="mr-2 h-4 w-4" />
                  <span>{action.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
