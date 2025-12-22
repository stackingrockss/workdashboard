# Skill: /hook

> Create custom React hooks following project patterns

## Purpose

Generate custom React hooks for:
- Data fetching with loading/error states
- Debounced values
- Local storage persistence
- Polling and real-time updates
- Form state management
- Shared logic extraction

## Questions to Ask

1. **Hook name** - usePascalCase (e.g., "useNotes", "usePolling", "useLocalStorage")
2. **Hook type** - What does it do?
   - Data fetching (API calls with state)
   - Debounce (delayed value updates)
   - Polling (periodic fetching)
   - Local storage (persisted state)
   - Form helpers (validation, submission)
   - Utility (custom logic)
3. **Dependencies** - What does it need?
   - API endpoint
   - Initial values
   - Configuration options

## Output Files

```
src/hooks/use{HookName}.ts
src/hooks/index.ts  (update exports)
```

## Hook Templates

### Data Fetching Hook

```typescript
// src/hooks/use{Entities}.ts
// Hook for fetching and managing {entities}

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { {Entity} } from "@/types/{entity}";

interface Use{Entities}Options {
  parentId?: string;
  initialFilter?: string;
  autoFetch?: boolean;
}

interface Use{Entities}Return {
  {entities}: {Entity}[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  create: (data: Partial<{Entity}>) => Promise<{Entity} | null>;
  update: (id: string, data: Partial<{Entity}>) => Promise<{Entity} | null>;
  remove: (id: string) => Promise<boolean>;
}

export function use{Entities}(options: Use{Entities}Options = {}): Use{Entities}Return {
  const { parentId, initialFilter, autoFetch = true } = options;

  const [{entities}, set{Entities}] = useState<{Entity}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch {entities}
  const fetch{Entities} = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (initialFilter) params.set("filter", initialFilter);

      const url = parentId
        ? `/api/v1/parent/${parentId}/{entities}?${params}`
        : `/api/v1/{entities}?${params}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch {entities}");
      }

      const data = await response.json();
      set{Entities}(data.{entities} || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [parentId, initialFilter]);

  // Create {entity}
  const create = useCallback(
    async (data: Partial<{Entity}>): Promise<{Entity} | null> => {
      try {
        const url = parentId
          ? `/api/v1/parent/${parentId}/{entities}`
          : `/api/v1/{entities}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create");
        }

        const result = await response.json();
        set{Entities}((prev) => [result.{entity}, ...prev]);
        toast.success("{Entity} created");
        return result.{entity};
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create");
        return null;
      }
    },
    [parentId]
  );

  // Update {entity}
  const update = useCallback(
    async (id: string, data: Partial<{Entity}>): Promise<{Entity} | null> => {
      try {
        const response = await fetch(`/api/v1/{entities}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update");
        }

        const result = await response.json();
        set{Entities}((prev) =>
          prev.map((item) => (item.id === id ? result.{entity} : item))
        );
        toast.success("{Entity} updated");
        return result.{entity};
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update");
        return null;
      }
    },
    []
  );

  // Delete {entity}
  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/v1/{entities}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      set{Entities}((prev) => prev.filter((item) => item.id !== id));
      toast.success("{Entity} deleted");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      return false;
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetch{Entities}();
    }
  }, [autoFetch, fetch{Entities}]);

  return {
    {entities},
    loading,
    error,
    refetch: fetch{Entities},
    create,
    update,
    remove,
  };
}
```

### Debounce Hook

```typescript
// src/hooks/useDebounce.ts
// Hook for debouncing values (e.g., search input)

"use client";

import { useState, useEffect } from "react";

/**
 * Debounces a value by the specified delay
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * const [search, setSearch] = useState("");
 * const debouncedSearch = useDebounce(search, 300);
 *
 * useEffect(() => {
 *   // This runs 300ms after the user stops typing
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### Polling Hook

```typescript
// src/hooks/usePolling.ts
// Hook for polling data at regular intervals

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>;
  interval: number; // milliseconds
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UsePollingReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  start: () => void;
  stop: () => void;
}

export function usePolling<T>({
  fetcher,
  interval,
  enabled = true,
  onSuccess,
  onError,
}: UsePollingOptions<T>): UsePollingReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(enabled);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Polling failed");
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [fetcher, onSuccess, onError]);

  // Start polling
  const start = useCallback(() => {
    setIsPolling(true);
  }, []);

  // Stop polling
  const stop = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Set up polling interval
  useEffect(() => {
    if (!isPolling) return;

    // Initial fetch
    fetchData();

    // Set up interval
    intervalRef.current = setInterval(fetchData, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPolling, interval, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    start,
    stop,
  };
}
```

### Local Storage Hook

```typescript
// src/hooks/useLocalStorage.ts
// Hook for persisting state in localStorage

"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Persists state in localStorage with SSR support
 * @param key - Storage key
 * @param initialValue - Default value if not in storage
 *
 * @example
 * const [theme, setTheme] = useLocalStorage("theme", "light");
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Initialize with initialValue (for SSR)
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
    setIsHydrated(true);
  }, [key]);

  // Update localStorage when value changes
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Remove from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
```

### Toggle Hook

```typescript
// src/hooks/useToggle.ts
// Hook for boolean toggle state

"use client";

import { useState, useCallback } from "react";

/**
 * Simple boolean toggle hook
 * @param initialValue - Initial boolean value (default: false)
 *
 * @example
 * const [isOpen, toggle, setIsOpen] = useToggle(false);
 * <button onClick={toggle}>Toggle</button>
 */
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  return [value, toggle, setValue];
}
```

### Async Handler Hook

```typescript
// src/hooks/useAsync.ts
// Hook for handling async operations with loading/error states

"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface UseAsyncOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseAsyncReturn<T, Args extends unknown[]> {
  execute: (...args: Args) => Promise<T | null>;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Wraps async functions with loading/error state management
 *
 * @example
 * const { execute, loading, error } = useAsync(
 *   async (id: string) => {
 *     const response = await fetch(`/api/items/${id}`);
 *     return response.json();
 *   },
 *   { successMessage: "Item loaded!" }
 * );
 */
export function useAsync<T, Args extends unknown[]>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOptions = {}
): UseAsyncReturn<T, Args> {
  const { onSuccess, onError, successMessage, errorMessage } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await asyncFunction(...args);
        if (successMessage) {
          toast.success(successMessage);
        }
        onSuccess?.();
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        toast.error(errorMessage || error.message);
        onError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [asyncFunction, onSuccess, onError, successMessage, errorMessage]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { execute, loading, error, reset };
}
```

### Media Query Hook

```typescript
// src/hooks/useMediaQuery.ts
// Hook for responsive design with media queries

"use client";

import { useState, useEffect } from "react";

/**
 * Tracks a media query match state
 * @param query - CSS media query string
 *
 * @example
 * const isMobile = useMediaQuery("(max-width: 767px)");
 * const isDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// Preset breakpoints
export const MOBILE_QUERY = "(max-width: 767px)";
export const TABLET_QUERY = "(min-width: 768px) and (max-width: 1023px)";
export const DESKTOP_QUERY = "(min-width: 1024px)";
```

## Export Pattern

```typescript
// src/hooks/index.ts
// Central export for all hooks

export { useDebounce } from "./useDebounce";
export { useLocalStorage } from "./useLocalStorage";
export { useToggle } from "./useToggle";
export { useAsync } from "./useAsync";
export { usePolling } from "./usePolling";
export { useMediaQuery, MOBILE_QUERY, TABLET_QUERY, DESKTOP_QUERY } from "./useMediaQuery";
// Add new hooks here
```

## Usage Examples

```tsx
// Data fetching
const { notes, loading, create, remove } = useNotes({ parentId: opportunityId });

// Debounced search
const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 300);

// Polling for status updates
const { data: status } = usePolling({
  fetcher: () => fetch(`/api/status/${id}`).then(r => r.json()),
  interval: 5000,
  enabled: status !== "completed",
});

// Persisted preference
const [sidebarOpen, setSidebarOpen] = useLocalStorage("sidebar-open", true);

// Async action with loading
const { execute: deleteItem, loading: deleting } = useAsync(
  async (id: string) => {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
  },
  { successMessage: "Deleted!" }
);
```

## Chaining

After creating hooks, consider:
- **`/component`** - Components that use the hook
- **`/test`** - Hook tests

## Checklist

- [ ] Hook starts with "use" prefix
- [ ] Follows Rules of Hooks
- [ ] Proper cleanup in useEffect
- [ ] Memoized callbacks with useCallback
- [ ] TypeScript types for all parameters/returns
- [ ] SSR-safe (no window access on initial render)
- [ ] Exported from index.ts
