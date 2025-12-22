# Skill: /test

> Generate tests for components, hooks, and API routes

## Purpose

Generate tests following project patterns:
- Jest + React Testing Library for components
- Jest for hooks and utilities
- API route testing with mocked Prisma
- Consistent mocking patterns

## Questions to Ask

1. **Test target** - What to test?
   - Component (React component)
   - Hook (custom React hook)
   - API route (Next.js route handler)
   - Utility (helper function)
2. **Target path** - File path of the item to test
3. **Test coverage** - What scenarios?
   - Rendering
   - User interactions
   - Loading/error states
   - Edge cases

## Output Files

```
# Component tests
src/components/features/{area}/__tests__/{Component}.test.tsx

# Hook tests
src/hooks/__tests__/use{Hook}.test.ts

# API route tests
src/app/api/v1/{resource}/__tests__/route.test.ts

# Utility tests
src/lib/__tests__/{utility}.test.ts
```

## Test Setup (If Not Configured)

### Jest Configuration

```typescript
// jest.config.ts
import type { Config } from "jest";
import nextJest from "next/jest";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
  ],
};

export default createJestConfig(config);
```

### Jest Setup

```typescript
// jest.setup.ts
import "@testing-library/jest-dom";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}));
```

## Component Test Template

```tsx
// src/components/features/{area}/__tests__/{Entity}Card.test.tsx
// Tests for {Entity}Card component

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { {Entity}Card } from "../{Entity}Card";
import { {Entity} } from "@/types/{entity}";

// Mock data
const mock{Entity}: {Entity} = {
  id: "test-id-123",
  name: "Test {Entity}",
  description: "Test description",
  status: "active",
  organizationId: "org-123",
  ownerId: "user-123",
  owner: {
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
  },
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("{Entity}Card", () => {
  // =========================================================================
  // Rendering Tests
  // =========================================================================
  describe("rendering", () => {
    it("renders {entity} name", () => {
      render(<{Entity}Card {entity}={mock{Entity}} />);

      expect(screen.getByText("Test {Entity}")).toBeInTheDocument();
    });

    it("renders {entity} description", () => {
      render(<{Entity}Card {entity}={mock{Entity}} />);

      expect(screen.getByText("Test description")).toBeInTheDocument();
    });

    it("renders status badge", () => {
      render(<{Entity}Card {entity}={mock{Entity}} />);

      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders without description when not provided", () => {
      const {entity}WithoutDesc = { ...mock{Entity}, description: null };
      render(<{Entity}Card {entity}={{entity}WithoutDesc} />);

      expect(screen.getByText("Test {Entity}")).toBeInTheDocument();
      expect(screen.queryByText("Test description")).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Interaction Tests
  // =========================================================================
  describe("interactions", () => {
    it("calls onClick when card is clicked", async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(<{Entity}Card {entity}={mock{Entity}} onClick={handleClick} />);

      await user.click(screen.getByText("Test {Entity}"));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("calls onDelete when delete button is clicked", async () => {
      const user = userEvent.setup();
      const handleDelete = jest.fn();

      render(<{Entity}Card {entity}={mock{Entity}} onDelete={handleDelete} />);

      // Open dropdown menu
      const moreButton = screen.getByRole("button", { name: /more/i });
      await user.click(moreButton);

      // Click delete option
      const deleteButton = screen.getByText("Delete");
      await user.click(deleteButton);

      expect(handleDelete).toHaveBeenCalledTimes(1);
    });

    it("does not trigger onClick when delete is clicked", async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      const handleDelete = jest.fn();

      render(
        <{Entity}Card
          {entity}={mock{Entity}}
          onClick={handleClick}
          onDelete={handleDelete}
        />
      );

      const moreButton = screen.getByRole("button", { name: /more/i });
      await user.click(moreButton);

      const deleteButton = screen.getByText("Delete");
      await user.click(deleteButton);

      expect(handleDelete).toHaveBeenCalled();
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Accessibility Tests
  // =========================================================================
  describe("accessibility", () => {
    it("has accessible name for action buttons", () => {
      render(<{Entity}Card {entity}={mock{Entity}} onDelete={jest.fn()} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("can be navigated with keyboard", async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(<{Entity}Card {entity}={mock{Entity}} onClick={handleClick} />);

      await user.tab();
      await user.keyboard("{Enter}");

      // Card should be focusable and activatable
    });
  });
});
```

## Hook Test Template

```typescript
// src/hooks/__tests__/useDebounce.test.ts
// Tests for useDebounce hook

import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));

    expect(result.current).toBe("initial");
  });

  it("debounces value changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "initial" } }
    );

    // Update value
    rerender({ value: "updated" });

    // Value should not change immediately
    expect(result.current).toBe("initial");

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Value should be updated after delay
    expect(result.current).toBe("updated");
  });

  it("cancels pending updates on new value", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "initial" } }
    );

    // Update value
    rerender({ value: "first" });

    // Advance partially
    act(() => {
      jest.advanceTimersByTime(150);
    });

    // Update again before debounce completes
    rerender({ value: "second" });

    // Complete the full delay
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should have the latest value
    expect(result.current).toBe("second");
  });

  it("uses custom delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: "initial" } }
    );

    rerender({ value: "updated" });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should still be initial (delay is 500ms)
    expect(result.current).toBe("initial");

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Now should be updated
    expect(result.current).toBe("updated");
  });
});
```

## API Route Test Template

```typescript
// src/app/api/v1/{resources}/__tests__/route.test.ts
// Tests for {resources} API routes

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Mock Prisma
jest.mock("@/lib/db", () => ({
  prisma: {
    {resource}: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(),
}));

const mockUser = {
  id: "user-123",
  name: "Test User",
  email: "test@example.com",
  organization: {
    id: "org-123",
    name: "Test Org",
  },
  directReports: [],
};

const mock{Entity} = {
  id: "{entity}-123",
  name: "Test {Entity}",
  description: "Test description",
  status: "active",
  organizationId: "org-123",
  ownerId: "user-123",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/v1/{resources}", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);
  });

  it("returns {resources} for authenticated user", async () => {
    (prisma.{resource}.findMany as jest.Mock).mockResolvedValue([mock{Entity}]);

    const request = new NextRequest("http://localhost/api/v1/{resources}");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.{resources}).toHaveLength(1);
    expect(data.{resources}[0].name).toBe("Test {Entity}");
  });

  it("scopes query to organization", async () => {
    (prisma.{resource}.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/v1/{resources}");
    await GET(request);

    expect(prisma.{resource}.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-123",
        }),
      })
    );
  });

  it("returns 401 for unauthenticated user", async () => {
    (requireAuth as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

    const request = new NextRequest("http://localhost/api/v1/{resources}");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("supports search filter", async () => {
    (prisma.{resource}.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/v1/{resources}?search=test"
    );
    await GET(request);

    expect(prisma.{resource}.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "test", mode: "insensitive" },
        }),
      })
    );
  });
});

describe("POST /api/v1/{resources}", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);
  });

  it("creates {resource} for authenticated user", async () => {
    (prisma.{resource}.create as jest.Mock).mockResolvedValue(mock{Entity});

    const request = new NextRequest("http://localhost/api/v1/{resources}", {
      method: "POST",
      body: JSON.stringify({
        name: "New {Entity}",
        description: "New description",
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.{resource}).toBeDefined();
  });

  it("sets organizationId from authenticated user", async () => {
    (prisma.{resource}.create as jest.Mock).mockResolvedValue(mock{Entity});

    const request = new NextRequest("http://localhost/api/v1/{resources}", {
      method: "POST",
      body: JSON.stringify({
        name: "New {Entity}",
      }),
    });
    await POST(request);

    expect(prisma.{resource}.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-123",
        }),
      })
    );
  });

  it("returns 400 for invalid input", async () => {
    const request = new NextRequest("http://localhost/api/v1/{resources}", {
      method: "POST",
      body: JSON.stringify({
        // Missing required name field
        description: "Description only",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 401 for unauthenticated user", async () => {
    (requireAuth as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

    const request = new NextRequest("http://localhost/api/v1/{resources}", {
      method: "POST",
      body: JSON.stringify({
        name: "New {Entity}",
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});
```

## Utility Test Template

```typescript
// src/lib/__tests__/format.test.ts
// Tests for formatting utilities

import {
  formatCurrencyCompact,
  formatDateShort,
  formatCurrencyInput,
  parseCurrencyInput,
} from "../format";

describe("formatCurrencyCompact", () => {
  it("formats thousands with K suffix", () => {
    expect(formatCurrencyCompact(1000)).toBe("$1K");
    expect(formatCurrencyCompact(5500)).toBe("$5.5K");
    expect(formatCurrencyCompact(50000)).toBe("$50K");
  });

  it("formats millions with M suffix", () => {
    expect(formatCurrencyCompact(1000000)).toBe("$1M");
    expect(formatCurrencyCompact(2500000)).toBe("$2.5M");
  });

  it("formats small numbers without suffix", () => {
    expect(formatCurrencyCompact(100)).toBe("$100");
    expect(formatCurrencyCompact(999)).toBe("$999");
  });

  it("handles zero", () => {
    expect(formatCurrencyCompact(0)).toBe("$0");
  });

  it("handles negative numbers", () => {
    expect(formatCurrencyCompact(-5000)).toBe("-$5K");
  });
});

describe("formatDateShort", () => {
  it("formats date to short format", () => {
    const date = new Date("2024-12-25");
    expect(formatDateShort(date)).toBe("Dec 25, 2024");
  });

  it("handles ISO string input", () => {
    expect(formatDateShort("2024-01-15")).toBe("Jan 15, 2024");
  });
});

describe("parseCurrencyInput", () => {
  it("parses formatted currency string to number", () => {
    expect(parseCurrencyInput("$1,234,567")).toBe(1234567);
    expect(parseCurrencyInput("1,000")).toBe(1000);
    expect(parseCurrencyInput("500")).toBe(500);
  });

  it("handles empty input", () => {
    expect(parseCurrencyInput("")).toBe(0);
  });
});
```

## Test Utilities

```typescript
// src/test/utils.tsx
// Test utilities and custom render

import { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";

// Custom render with providers if needed
const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    // Add providers here (e.g., ThemeProvider, QueryClientProvider)
    <>{children}</>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: AllProviders, ...options });

export * from "@testing-library/react";
export { customRender as render };

// Mock factories
export const createMock{Entity} = (overrides = {}): {Entity} => ({
  id: "test-id",
  name: "Test {Entity}",
  description: null,
  status: "active",
  organizationId: "org-123",
  ownerId: "user-123",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: "user-123",
  name: "Test User",
  email: "test@example.com",
  organization: {
    id: "org-123",
    name: "Test Org",
  },
  ...overrides,
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- {Entity}Card.test.tsx

# Run with coverage
npm test -- --coverage

# Run tests matching pattern
npm test -- --testPathPattern=api
```

## Checklist

- [ ] Tests cover happy path
- [ ] Tests cover error states
- [ ] Tests cover edge cases
- [ ] Mocks are properly reset between tests
- [ ] Async operations are properly awaited
- [ ] User interactions use userEvent
- [ ] Accessibility assertions included
- [ ] Organization scoping verified for API tests
