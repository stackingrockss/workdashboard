"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { cn } from "@/lib/utils";
import {
  SlashCommandItem,
  groupSlashCommands,
  GROUP_LABELS,
} from "./extensions/slash-command";

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

/**
 * Slash command menu component
 * Renders a filterable list of commands when user types "/"
 */
export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem) {
      selectedItem.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    [items, command]
  );

  // Handle keyboard navigation
  const onKeyDown = useCallback(
    ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
        return true;
      }

      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
        return true;
      }

      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
    [items.length, selectItem, selectedIndex]
  );

  // Expose keyboard handler to parent
  useImperativeHandle(ref, () => ({
    onKeyDown,
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
        No results found
      </div>
    );
  }

  // Group items for display
  const groupedItems = groupSlashCommands(items);
  const groups = Object.entries(groupedItems);

  // Calculate flat index for each item
  let flatIndex = 0;
  const getItemIndex = () => flatIndex++;

  return (
    <div
      ref={containerRef}
      className="max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
    >
      {groups.map(([group, groupItems]) => (
        <div key={group}>
          {/* Group label */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {GROUP_LABELS[group] || group}
          </div>

          {/* Group items */}
          {groupItems.map((item) => {
            const index = getItemIndex() - 1;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onClick={() => selectItem(index)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none",
                  index === selectedIndex && "bg-accent text-accent-foreground"
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  {item.icon}
                </span>
                <div className="flex flex-col">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

SlashCommandMenu.displayName = "SlashCommandMenu";

/**
 * Helper to render the slash command menu in a portal
 */
export function renderSlashCommandMenu(
  items: SlashCommandItem[],
  command: (item: SlashCommandItem) => void,
  clientRect: (() => DOMRect | null) | null,
  menuRef: React.RefObject<SlashCommandMenuRef | null>
): React.ReactNode {
  const rect = clientRect?.();

  if (!rect) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        zIndex: 50,
      }}
    >
      <SlashCommandMenu ref={menuRef} items={items} command={command} />
    </div>
  );
}
