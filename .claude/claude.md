# Claude Agent Rules for Sales Opportunity Tracker

## 🧠 General Philosophy

- **Always prioritize clarity, modularity, and developer experience**
- Follow convention over configuration where applicable
- If unsure about implementation choices, ask for clarification or default to modern best practices
- Optimize for performance using React.memo, useCallback, and useMemo where appropriate, especially in Kanban components, data tables, and opportunity lists
- Ensure accessibility by using semantic HTML, ARIA attributes, and keyboard navigation for all interactive elements (especially drag-and-drop, modals, and filters)
- **Business logic focus**: This is a sales/CRM tool—prioritize data accuracy, validation, and clear user workflows for sales teams
- **Prefer Server Components by default**: Use `"use client"` only when you need interactivity, state, or browser APIs

---

## 📦 Project Stack

| Technology | Purpose |
|-----------|---------|
| **Framework** | Next.js 15+ (App Router, React 19) |
| **Language** | TypeScript (strict mode) |
| **Styling** | TailwindCSS v4 |
| **UI Kit** | shadcn/ui (New York style, Slate base) |
| **Database** | Prisma + PostgreSQL |
| **Auth** | *To be determined* (Supabase or NextAuth) |
| **State** | useState, Context, Zustand if needed |
| **Validation** | Zod |
| **Forms** | *To install*: React Hook Form + @hookform/resolvers |
| **Toasts** | *To install*: sonner or react-hot-toast |
| **Icons** | lucide-react |
| **Drag & Drop** | *Future*: @dnd-kit (recommended for accessibility) |
| **Deployment** | Vercel |
| **Error Tracking** | *Optional*: Sentry or LogRocket |
| **Analytics** | *Optional*: Vercel Analytics or Mixpanel |

**Path Aliases** (configured in `tsconfig.json` and `components.json`):
```ts
import { Button } from "@/components/ui/button";     // → src/components/ui/button
import { formatCurrency } from "@/lib/format";       // → src/lib/format
import { Opportunity } from "@/types/opportunity";   // → src/types/opportunity
import { useDebounce } from "@/hooks/useDebounce";   // → src/hooks/useDebounce
```

**Always use path aliases (`@/`)** instead of relative imports (`../../`) for better maintainability.

---

## 📁 Folder Structure

```
/opportunity-tracker
  /src
    /app
      /opportunities
        /[id]
          page.tsx
      /dashboard
      /api
        /v1
          /opportunities
            route.ts
            /[id]
              route.ts
      layout.tsx
      page.tsx
      globals.css
    /components
      /kanban
        KanbanBoard.tsx
        KanbanBoardWrapper.tsx
        KanbanColumn.tsx
        OpportunityCard.tsx
        DraggableOpportunityCard.tsx
        ColumnTemplateDialog.tsx
      /forms
        opportunity-form.tsx
        column-form.tsx
      /ui (shadcn components)
        button.tsx
        card.tsx
        dialog.tsx
        tabs.tsx
        dropdown-menu.tsx
        tooltip.tsx
        ...
    /lib
      /validations
        opportunity.ts
      /templates
        column-templates.ts
      /utils
        quarter.ts
        quarterly-view.ts
      utils.ts
      db.ts
      format.ts
    /types
      opportunity.ts
    /hooks (create as needed)
      useDebounce.ts
      useOpportunities.ts
    /data
      mock-opportunities.ts (temporary, replace with DB)
  /prisma
    schema.prisma
    /migrations
  /public
    /images
```

**Rules:**
- Keep all app routes under `/src/app`
- Store reusable business components in `/src/components` (e.g., `KanbanBoard`, `OpportunityCard`)
- Store shadcn/ui components in `/src/components/ui`
- Place Prisma schema and migrations in `/prisma`
- Store utility functions, validation schemas, and DB helpers in `/src/lib`
- Define TypeScript types in `/src/types`
- Create `/src/hooks` for custom React hooks

---

## 🧩 Component Rules

- **Use function components with arrow syntax**
- **Server Components by default**: Only add `"use client"` when you need:
  - State hooks (`useState`, `useReducer`)
  - Effect hooks (`useEffect`, `useLayoutEffect`)
  - Event handlers (`onClick`, `onChange`)
  - Browser APIs (`window`, `localStorage`)
  - Third-party libraries that require client-side rendering
- Always define props via TypeScript interfaces (never use `any`)
- Destructure props in function signatures for clarity:
  ```tsx
  export const OpportunityCard = ({ opportunity, onOpen }: OpportunityCardProps) => { ... }
  ```
- Co-locate small, page-specific components within the page folder when they're not reusable
- **Reuse common components** like:
  - `<OpportunityCard />`
  - `<KanbanBoard />`
  - `<KanbanColumn />`
  - `<OpportunityDialog />`
  - `<OpportunityForm />`
- Document reusable components with JSDoc comments including props, usage examples, and dependencies
- **Kanban-specific rules:**
  - Always memoize filtered/grouped opportunity data using `useMemo`
  - Use unique keys based on `opportunity.id`, not array index
  - Handle loading and empty states explicitly
  - KanbanBoard is a client component (needs state for filtering)
  - Individual cards can be server components if no interactivity

---

## 🗄️ Database & Prisma Rules

**Current Schema:**
- **User**: `id`, `email`, `name`, `avatarUrl`
- **Opportunity**: `id`, `name`, `account`, `amountArr`, `probability`, `nextStep`, `closeDate`, `stage`, `ownerId`
- **OpportunityStage** enum: `prospect`, `qualification`, `proposal`, `negotiation`, `closedWon`, `closedLost`

**Rules:**
- ✅ **Use Prisma for all database access**—no raw SQL
- Always validate inputs with Zod before database operations
- Use `@prisma/client` types directly in TypeScript interfaces
- Run `npx prisma generate` after schema changes
- Run `npx prisma migrate dev --name <description>` for new migrations
- **Always scope queries by `ownerId`** when dealing with user-specific data
- Use `prisma/client` singleton from `/src/lib/db.ts`
- Follow Prisma naming conventions:
  - Models: PascalCase (e.g., `Opportunity`, `User`)
  - Fields: camelCase (e.g., `amountArr`, `closeDate`)
  - Relations: pluralize for one-to-many (e.g., `opportunities: Opportunity[]`)
- **Include relations when needed**: Use `include: { owner: true }` to get owner data with opportunities
- Use `orderBy`, `skip`, `take` for pagination and sorting

---

## 🔐 Auth Rules

**Status:** Auth not yet implemented.

**When implementing:**
- Use Supabase Auth (preferred) or NextAuth.js
- Wrap protected routes with session checks (e.g., `createServerComponentClient()` for Supabase)
- Redirect unauthenticated users to `/login`
- Store user info in session and link opportunities to `ownerId`
- Implement role-based access control (RBAC) if needed (e.g., admin vs. sales rep)
- Use middleware (`middleware.ts` in root) to protect `/opportunities` and `/api/v1/*` routes
- Never expose sensitive user data in client components—fetch in server components

---

## 🚀 API Rules

**Current API structure:**
- `POST /api/v1/opportunities` → Create opportunity
- `GET /api/v1/opportunities` → List opportunities (with filters)
- `GET /api/v1/opportunities/[id]` → Get single opportunity
- `PATCH /api/v1/opportunities/[id]` → Update opportunity
- `DELETE /api/v1/opportunities/[id]` → Delete opportunity

**Rules:**
- Always validate request body with Zod schemas (from `/src/lib/validations/`)
- Return **consistent JSON responses** matching existing patterns:
  ```ts
  // Success (list)
  return NextResponse.json({ opportunities }, { status: 200 });

  // Success (single)
  return NextResponse.json({ opportunity }, { status: 200 });

  // Created
  return NextResponse.json({ opportunity: created }, { status: 201 });

  // Error
  return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Validation error (use Zod's flatten)
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  ```
- Wrap async logic in `try/catch` blocks
- Use `skip` and `take` for pagination on list endpoints
- Version all API routes under `/api/v1/` to allow future changes
- Always scope queries by user session (once auth is implemented)
- Use HTTP status codes correctly: `200` (OK), `201` (Created), `400` (Bad Request), `401` (Unauthorized), `404` (Not Found), `500` (Server Error)
- Always include `{ owner: true }` when returning opportunities to match the `Opportunity` type

---

## 🔧 Form Handling Rules

- Use **React Hook Form + Zod** for all forms (requires installing `react-hook-form` and `@hookform/resolvers`)
- Define Zod schemas in `/src/lib/validations/`
- **Reuse existing schemas**: Use `opportunityCreateSchema` and `opportunityUpdateSchema` from `/src/lib/validations/opportunity.ts`
- Display inline errors for each field
- Show loading state on submit button (e.g., `disabled` + spinner)
- Use `onSubmit` with `async/await`, not `.then()`
- Debounce real-time inputs (e.g., search, filters) using a custom `useDebounce` hook or `lodash.debounce`
- Ensure forms are accessible:
  - Use `<label>` tags with `htmlFor`
  - Use ARIA attributes for errors (`aria-invalid`, `aria-describedby`)
  - Ensure keyboard navigation works (Tab, Enter, Escape)

**Example form structure:**
```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { opportunityCreateSchema, type OpportunityCreateInput } from "@/lib/validations/opportunity";

const form = useForm<OpportunityCreateInput>({
  resolver: zodResolver(opportunityCreateSchema),
});

const onSubmit = async (data: OpportunityCreateInput) => {
  try {
    const res = await fetch('/api/v1/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create');
    toast.success("Opportunity created!");
  } catch (error) {
    toast.error("Failed to create opportunity");
  }
};
```

---

## 💅 UI/UX Standards

- **Use shadcn/ui** for all inputs, buttons, dialogs, dropdowns, etc.
- Always use Tailwind utility classes for styling (no inline CSS or styled-components)
- Ensure responsive design using Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)
- Use **lucide-react** for all icons
- Prefer semantic HTML: `<section>`, `<nav>`, `<form>`, `<article>`
- Support dark mode using Tailwind's `dark:` prefix
- Use skeleton loaders (e.g., shadcn/ui `<Skeleton />`) for loading states
- **Provide fallback UI** for:
  - Empty states (e.g., "No opportunities found")
  - Loading states (e.g., skeleton cards)
  - Error states (e.g., toast notifications)

**Kanban UI Rules:**
- Each column should have a clear header with stage name and count
- Cards should be visually distinct with borders and hover effects
- Use consistent spacing (e.g., `gap-4` between columns, `p-4` inside cards)
- Display key info on cards: opportunity name, account, ARR, probability, close date
- Use badges to indicate stage, status, or priority
- Use grid layout for columns: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6`

**Kanban Column System:**
The Kanban board supports two view modes and includes a template system for quick setup:

1. **Custom View Mode** (default):
   - Users create and manage their own columns via database (`KanbanColumn` model)
   - Columns can be renamed, reordered, and colored
   - Opportunities are assigned to columns via `columnId` field
   - Full drag-and-drop support for moving opportunities between columns

2. **Quarterly View Mode**:
   - Virtual columns generated dynamically from opportunities' close dates
   - Columns represent fiscal quarters (e.g., "Q1 2025", "Q2 2025")
   - Opportunities automatically grouped by calculated quarter
   - Read-only mode: drag-and-drop disabled, columns cannot be edited
   - Respects user's fiscal year start month setting

3. **Column Templates**:
   - Predefined templates for common workflows (located in `/src/lib/templates/column-templates.ts`)
   - Available templates:
     - **Quarterly Forecast**: Current + next 3 quarters (time-based tracking)
     - **Sales Stages**: Discovery → Demo → Validate Solution → Decision Maker Approval → Contracting → Closed Won/Lost
     - **Forecast Categories**: Pipeline → Best Case → Commit → Closed Won/Lost
     - **Start Blank**: No columns (user builds custom structure)
   - Templates applied via "Apply Template" dropdown in column management UI

4. **Auto-Creation for New Users**:
   - When a user accesses the opportunities page for the first time with zero columns
   - System automatically creates quarterly columns (current + next 3 quarters)
   - Provides "opinionated defaults" without forcing a specific structure
   - Users can immediately switch to custom view or apply different templates

5. **View Mode Toggle**:
   - Tabs UI component in toolbar: "Custom" vs "Quarterly"
   - User preference persisted in localStorage (`kanban-view-mode`)
   - "Add Column" button hidden in quarterly mode (virtual columns cannot be added)

**Technical Implementation:**
- Custom mode: Uses `columns` from database, groups by `opportunity.columnId`
- Quarterly mode: Uses `generateQuarterlyColumns()` and `groupOpportunitiesByQuarter()` from `/src/lib/utils/quarterly-view.ts`
- Templates: Use `getTemplateById()` and `prepareTemplateForCreation()` from `/src/lib/templates/column-templates.ts`
- Fiscal year support: All quarter calculations use `fiscalYearStartMonth` from user settings
- Virtual columns have IDs like `virtual-Q1-2025` to distinguish from database columns

**Currency & Date Formatting:**
- **Always use formatting utilities** from `/src/lib/format.ts`:
  ```tsx
  import { formatCurrencyCompact, formatDateShort } from "@/lib/format";

  // Display ARR
  {formatCurrencyCompact(opportunity.amountArr)} // → "$50K"

  // Display close date
  {formatDateShort(opportunity.closeDate)} // → "Dec 31, 2024"
  ```
- Do not hardcode currency/date formatting—reuse existing utilities

---

## 📊 Testing & Quality Rules

- Use **ESLint** and **Prettier** for code formatting
- Current ESLint config extends `next/core-web-vitals` and `next/typescript`
- Use **Jest + React Testing Library** for unit tests (requires installation)
- Test critical components: `OpportunityCard`, `KanbanBoard`, `OpportunityForm`
- Test API routes with mock Prisma client
- Aim for **80%+ test coverage** on critical paths
- Mock external services (e.g., Prisma, auth) using `msw` or Vitest mocks
- Use Playwright for e2e tests (post-MVP)

---

## ✍️ Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| **Components** | PascalCase.tsx | `OpportunityCard.tsx`, `KanbanBoard.tsx` |
| **Variables** | camelCase | `opportunities`, `filterText`, `amountArr` |
| **DB Models** | PascalCase | `Opportunity`, `User` |
| **Routes** | kebab-case folders | `/opportunities`, `/api/v1/opportunities` |
| **API handlers** | RESTful + HTTP methods | `GET /api/v1/opportunities`, `POST /api/v1/opportunities` |
| **Constants** | UPPER_SNAKE_CASE | `API_BASE_URL`, `DEFAULT_STAGE` |
| **Custom Hooks** | usePascalCase | `useOpportunities`, `useKanbanFilters`, `useDebounce` |
| **Enums** | PascalCase | `OpportunityStage` |
| **Zod Schemas** | camelCase + "Schema" suffix | `opportunityCreateSchema`, `opportunityUpdateSchema` |
| **Type Exports** | PascalCase + "Input" or "Data" suffix | `OpportunityCreateInput`, `OpportunityUpdateInput` |

---

## ⚠️ Avoid

- ❌ No inline CSS or styled-components
- ❌ No use of `any` in TypeScript
- ❌ No console logs in production code (use error tracking instead)
- ❌ No business logic in `page.tsx` files—isolate to helpers, components, or API routes
- ❌ No hardcoded values—use constants, environment variables, or database data
- ❌ Avoid adding new dependencies without justification
- ❌ Avoid client-side fetching of sensitive data when server-side rendering or API routes can be used
- ❌ Don't use relative imports (`../../lib/utils`) when path aliases (`@/lib/utils`) are available
- ❌ Don't add `"use client"` unnecessarily—default to server components
- ❌ Don't create custom formatters when `/src/lib/format.ts` utilities exist

---

## ✅ Output Formatting for Claude

**Always include:**
- The **filename**
- The **relative path** (e.g., `src/app/opportunities/page.tsx`)
- A **brief summary** of what the code does

**Use proper code blocks:**
```tsx
// src/components/kanban/OpportunityCard.tsx
// Displays a single opportunity card with ARR, probability, and next steps
```

**For updates:**
- Provide **minimal diffs** (only changed lines) to simplify reviews
- For significant changes, include a **changelog comment** at the top explaining what was added, modified, or removed

---

## 📣 Claude Should Ask

When implementing features, always clarify:
- "Would you like me to scaffold the route/component/API as a placeholder or build it to completion with full logic and UI?"
- "Should this form be part of the dashboard, a modal, or on its own page?"
- "What data source should this component pull from (e.g., Prisma query, API route, mock data)?"
- "Should this feature be scoped to a specific user (via `ownerId`) or global?"
- "Should this be a server component or client component?"
- "Do you want me to install missing dependencies (e.g., React Hook Form, Sonner) before proceeding?"

---

## 📋 Claude Prompt Templates

### 🧱 Scaffold a Page

```
Create a new page component for the route `/dashboard`. It should:
- Display key sales metrics (total ARR, win rate, deals in pipeline)
- Fetch data from the database via Prisma (server component)
- Use shadcn/ui Card components for metrics
- Use Tailwind for responsive layout
- Handle loading and error states
- Use formatCurrencyCompact for ARR display
```

### 🧪 Create a Form with Validation

```
Build an `OpportunityForm.tsx` component. It should:
- Allow users to create/edit an opportunity with fields: name, account, amountArr, probability, nextStep, closeDate, stage
- Use React Hook Form + Zod for validation
- Reuse opportunityCreateSchema from /src/lib/validations/opportunity.ts
- Display inline errors for each field
- Use shadcn/ui components (Input, Select, Button, DatePicker)
- On submit, send data to `/api/v1/opportunities` via POST
- Show a success toast on completion (using sonner)
- Note: This requires installing react-hook-form, @hookform/resolvers, and sonner
```

### 🔐 Protect a Page with Auth

```
Wrap the `/opportunities` page so it only renders if the user is authenticated.
- If not authenticated, redirect to `/login`
- Use `createServerComponentClient()` (Supabase) to get the session
- Pass `session.user.id` as `ownerId` to scope queries
- Keep the page as a server component
```

### 🔎 Create a Reusable Component

```
Create an `OpportunityCard.tsx` component that accepts:
- `opportunity: Opportunity` (matching the type from /src/types/opportunity.ts)
- `onOpen?: (id: string) => void` callback (optional, makes it a client component)
- Displays: name, account, ARR (formatted with formatCurrencyCompact), probability, stage badge, close date (formatted with formatDateShort)
- Has a "View Details" button that triggers `onOpen` if provided
- Uses shadcn/ui Card and Badge components
- Responsive and styled with Tailwind
- Only add "use client" if onOpen is provided
```

### 📊 Generate a Dashboard Chart

```
Create a chart component that shows total ARR by stage.
- Research and recommend a charting library compatible with React 19 (e.g., Recharts, Tremor, or visx)
- Fetch opportunity data grouped by stage (server component)
- X-axis: stage name; Y-axis: total ARR (formatted as currency)
- Title: "Pipeline by Stage"
- Responsive and styled with Tailwind
```

### ⚙️ Add API Endpoint

```
Create a `GET /api/v1/opportunities/stats` API route that returns:
- Total number of opportunities
- Total ARR across all stages
- Win rate (closedWon / (closedWon + closedLost))
- Average deal size
- Validate user session and scope to `ownerId` (when auth is implemented)
- Return JSON in format: { stats: { total, totalArr, winRate, avgDealSize } }
- Include proper error handling with try/catch
```

### 🧪 Unit Test a Component

```
Write a Jest test for the `OpportunityCard.tsx` component.
- Mock a sample `Opportunity` object
- Check that the opportunity name, account, and ARR render correctly
- Verify the ARR uses formatCurrencyCompact
- Verify the close date uses formatDateShort
- Ensure the stage badge displays the correct text
- Test that clicking "View Details" triggers the `onOpen` callback
```

### 🧩 Update an Existing Component

```
Update the `KanbanBoard.tsx` component to:
- Add a dropdown filter for "My Opportunities" vs. "All Opportunities"
- Update the filtering logic to support `ownerId` filtering
- Ensure TypeScript types are updated
- Use shadcn/ui DropdownMenu component
- Maintain existing search functionality
- Include tests for the new filter
```

### 🗄️ Update Prisma Schema

```
Update `prisma/schema.prisma` to add a new model or field:
- Add a `Note` model with fields for `id`, `content`, `opportunityId`, `authorId`, `createdAt`
- Add a relation to the `Opportunity` model (notes: Note[])
- Generate and apply migrations using `npx prisma migrate dev --name add-notes`
- Run `npx prisma generate` to update Prisma Client
- Update related API routes and types in `/src/types`
- Create Zod validation schema in `/src/lib/validations/note.ts`
```

### 🪝 Create a Custom Hook

```
Create a `useDebounce` custom hook in `/src/hooks/useDebounce.ts`:
- Accept a value and delay (ms)
- Return the debounced value
- Use TypeScript generics for type safety
- Include JSDoc comments with usage example
```

---

## 🔍 Claude AI Code Review Checklist

When reviewing code (Claude- or dev-generated), ensure:

✅ **TypeScript safe** (no `any`, proper interfaces used)
✅ **Follows project conventions** (folder structure, naming, path aliases)
✅ **Uses shadcn/ui and Tailwind appropriately**
✅ **Business logic is isolated** from `page.tsx` (moved to `/lib` or components)
✅ **Includes try/catch for async calls**
✅ **Includes Zod validation** where inputs exist
✅ **Reuses existing schemas** (`opportunityCreateSchema`, etc.)
✅ **Uses formatting utilities** (`formatCurrencyCompact`, `formatDateShort`)
✅ **Avoids hardcoded values** (uses database, constants, or environment variables)
✅ **Reuses functions or components** (no logic duplication)
✅ **Descriptive prop names and comments** for non-obvious logic
✅ **Fallback UI states** (loading, empty, error)
✅ **No performance bottlenecks** (excessive API calls, unoptimized loops, large state updates)
✅ **No unnecessary dependencies** introduced
✅ **Data is scoped to users** (queries include `ownerId` where appropriate)
✅ **Server components by default** (only uses `"use client"` when necessary)
✅ **API responses match existing format** (`{ opportunities }` or `{ opportunity }`)
✅ **Uses path aliases** (`@/`) instead of relative imports

---

## 🌍 Additional Considerations

- **Prepare for internationalization**: Structure strings to support `next-intl` or similar libraries (avoid hardcoded text in components)
- **Support offline functionality** (future): Cache opportunity data locally and sync when online
- **Follow consistent commit message format**: `feat: add opportunity form validation`, `fix: resolve Kanban filter bug`, `refactor: extract Kanban logic to hooks`
- **Use feature branches** for development (e.g., `feature/opportunity-form`, `fix/kanban-drag-drop`)
- **Sales-specific considerations**:
  - Always format ARR as currency using `formatCurrencyCompact` (e.g., `$50K`)
  - Validate probability is between 0-100 (handled in Zod schema)
  - Ensure close dates are in the future for open opportunities
  - Use clear stage transitions in UI (e.g., Prospect → Qualification → Proposal → Negotiation → Closed)
  - Provide audit trails for opportunity updates (use `updatedAt` timestamps)
  - Display owner avatars and names using the `owner` relation

---

## 🧱 Scaling Rules for AI Assistance

As the app grows, Claude should:

1. **Respect the Source of Truth**
   - Always reference `prisma/schema.prisma`, not inferred field names
   - Use exported types from `/src/types` or Prisma Client instead of `any`
   - Do not assume routes or folders exist—check structure or ask

2. **State and Data Discipline**
   - Favor local state or context over prop drilling
   - Use Zod schemas for API input validation and form parsing
   - Reuse existing schemas from `/src/lib/validations/`
   - Add comments when state flows across more than one component

3. **Avoid Logic Duplication**
   - Do not rewrite logic already in `/src/lib` or `/src/components`—import it instead
   - Reuse existing utilities like `formatCurrencyCompact` and `formatDateShort`
   - If logic looks similar to an existing function, ask the dev or reuse it

4. **Stick to the UI Design System**
   - Use shadcn/ui components (New York style, Slate base color)
   - Never use raw HTML inputs or create custom styles unless instructed
   - Reuse existing components like `OpportunityCard`, `KanbanBoard`, `KanbanColumn`

5. **Add Error Handling and Feedback**
   - Always wrap async actions in `try/catch` blocks
   - Display UI feedback (e.g., toast) for success/failure
   - Log and handle edge cases: no data, API failure, invalid auth, etc.
   - Use consistent error response format: `{ error: "message" }`

6. **Ask When Ambiguous**
   - If you're not sure what the route should be called, where logic belongs, or what props a component expects, **ask for clarification**
   - If a required dependency is missing (e.g., React Hook Form, Sonner), **ask before proceeding**

---

## 🚦 Quick Reference

**Common Commands:**
```bash
# Development
npm run dev

# Database
npx prisma generate          # After schema changes
npx prisma migrate dev       # Create and apply migration
npx prisma studio           # Open Prisma Studio (DB GUI)

# Build & Deploy
npm run build
npm run start

# Linting
npm run lint
```

**File Locations:**
- Prisma schema: `prisma/schema.prisma`
- API routes: `src/app/api/v1/`
- Validation schemas: `src/lib/validations/`
- Utility functions: `src/lib/`
- Type definitions: `src/types/`
- shadcn/ui components: `src/components/ui/`
- Business components: `src/components/`
