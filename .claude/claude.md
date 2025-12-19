# Claude Agent Rules for Sales Opportunity Tracker

**Last Updated:** 2025-11-11

## 📚 Documentation Structure

This file imports specialized documentation for different aspects of the codebase:

@.claude/ARCHITECTURE.md
@.claude/API.md
@.claude/INTEGRATIONS.md
@.claude/MULTI_TENANCY.md

**Reference Documentation** (not auto-imported, access when needed):
- `.claude/reference/PROMPTS.md` - Ready-to-use prompts for common development tasks
- `.claude/reference/AI_ARCHITECTURE.md` - AI/LLM integration architecture
- `docs/` - User-facing setup guides (see `docs/README.md` for structure)

---

## 🧠 General Philosophy

- **Always prioritize clarity, modularity, and developer experience**
- Follow convention over configuration where applicable
- If unsure about implementation choices, ask for clarification or default to modern best practices
- Optimize for performance using React.memo, useCallback, and useMemo where appropriate, especially in Kanban components, data tables, and opportunity lists
- Ensure accessibility by using semantic HTML, ARIA attributes, and keyboard navigation for all interactive elements (especially drag-and-drop, modals, and filters)
- **Business logic focus**: This is a sales/CRM tool—prioritize data accuracy, validation, and clear user workflows for sales teams
- **Prefer Server Components by default**: Use `"use client"` only when you need interactivity, state, or browser APIs
- **Multi-tenant architecture**: Always scope queries by `organizationId` for strict data isolation

---

## 📦 Project Stack

| Technology | Purpose |
|-----------|---------|
| **Framework** | Next.js 15+ (App Router, React 19) |
| **Language** | TypeScript (strict mode) |
| **Styling** | TailwindCSS v4 |
| **UI Kit** | shadcn/ui (New York style, Slate base) |
| **Database** | Prisma + PostgreSQL |
| **Auth** | Supabase (SSR + Auth) ✅ Implemented |
| **State** | useState, Context, Zustand if needed |
| **Validation** | Zod |
| **Forms** | React Hook Form + @hookform/resolvers ✅ Installed |
| **Toasts** | sonner ✅ Installed |
| **Icons** | lucide-react |
| **Drag & Drop** | @dnd-kit ✅ Installed |
| **Background Jobs** | Inngest (async processing) |
| **AI** | Google Gemini (@google/generative-ai) |
| **Date Utilities** | date-fns |
| **Org Charts** | reactflow + dagre |
| **Markdown** | react-markdown + remark-gfm |
| **Git Hooks** | husky |
| **Deployment** | Vercel |
| **Error Tracking** | *Optional*: Sentry or LogRocket |
| **Analytics** | *Optional*: Vercel Analytics or Mixpanel |

**Path Aliases** (configured in `tsconfig.json` and `components.json`):
```ts
import { Button } from "@/components/ui/button";                  // → src/components/ui/button
import { formatCurrencyCompact } from "@/lib/format";             // → src/lib/format
import { Opportunity } from "@/types/opportunity";                // → src/types/opportunity
import { opportunityCreateSchema } from "@/lib/validations/opportunity"; // → src/lib/validations/opportunity
import { prisma } from "@/lib/db";                                // → src/lib/db
```

**Always use path aliases (`@/`)** instead of relative imports (`../../`) for better maintainability.

---

## 🧩 Component Rules

- **Use function components with arrow syntax**
- **Server Components by default**: Only add `"use client"` when you need:
  - State hooks (`useState`, `useReducer`)
  - Effect hooks (`useEffect`, `useLayoutEffect`)
  - Event handlers (`onClick`, `onChange`)
  - Browser APIs (`window`, `localStorage`)
  - Third-party libraries that require client-side rendering (e.g., @dnd-kit, reactflow)
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
  - `<ContactCard />`
  - `<AccountForm />`
- Document reusable components with JSDoc comments including props, usage examples, and dependencies
- **Kanban-specific rules:**
  - Always memoize filtered/grouped opportunity data using `useMemo`
  - Use unique keys based on `opportunity.id`, not array index
  - Handle loading and empty states explicitly
  - KanbanBoard is a client component (needs state for filtering)
  - Individual cards can be server components if no interactivity

---

## 🔧 Form Handling Rules

- Use **React Hook Form + Zod** for all forms
- Define Zod schemas in `/src/lib/validations/`
- **Reuse existing schemas**:
  - `opportunityCreateSchema`, `opportunityUpdateSchema` from `/src/lib/validations/opportunity.ts`
  - `accountCreateSchema`, `accountUpdateSchema` from `/src/lib/validations/account.ts`
  - `contactCreateSchema`, `contactUpdateSchema` from `/src/lib/validations/contact.ts`
  - `userUpdateSchema` from `/src/lib/validations/user.ts`
  - And others...
- Display inline errors for each field
- Show loading state on submit button (e.g., `disabled` + spinner)
- Use `onSubmit` with `async/await`, not `.then()`
- Debounce real-time inputs (e.g., search, filters) using a custom `useDebounce` hook
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
import { toast } from "sonner";

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
- Display key info on cards: opportunity name, account, ARR, confidence level, close date
- Use badges to indicate stage, status, or priority
- Use grid layout for columns: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6`

**Kanban Column System:**
The Kanban board supports multiple view modes and templates:

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

5. **View Management**:
   - Users can create multiple personal views
   - Admins can create shared views for entire organization
   - Tabs UI component to switch between views
   - View preferences persisted per user

**Technical Implementation:**
- Custom mode: Uses `columns` from database, groups by `opportunity.columnId`
- Quarterly mode: Uses `generateQuarterlyColumns()` and `groupOpportunitiesByQuarter()` from `/src/lib/utils/quarterly-view.ts`
- Templates: Use `getTemplateById()` and `prepareTemplateForCreation()` from `/src/lib/templates/column-templates.ts`
- Fiscal year support: All quarter calculations use `fiscalYearStartMonth` from organization settings
- Virtual columns have IDs like `virtual-Q1-2025` to distinguish from database columns

**Currency & Date Formatting:**
- **Always use formatting utilities** from `/src/lib/format.ts`:
  ```tsx
  import { formatCurrencyCompact, formatDateShort, formatCurrencyInput, parseCurrencyInput } from "@/lib/format";

  // Display ARR
  {formatCurrencyCompact(opportunity.amountArr)} // → "$50K"

  // Display close date
  {formatDateShort(opportunity.closeDate)} // → "Dec 31, 2024"

  // Currency input field (no $ symbol, with commas)
  {formatCurrencyInput(1234567)} // → "1,234,567"

  // Parse currency input back to number
  {parseCurrencyInput("$1,234,567")} // → 1234567
  ```
- Do not hardcode currency/date formatting—reuse existing utilities

---

## 📊 Testing & Quality Rules

- Use **ESLint** and **Prettier** for code formatting
- Current ESLint config extends `next/core-web-vitals` and `next/typescript`
- Use **Jest + React Testing Library** for unit tests (requires installation)
- Test critical components: `OpportunityCard`, `KanbanBoard`, `OpportunityForm`, `ContactCard`
- Test API routes with mock Prisma client
- Aim for **80%+ test coverage** on critical paths
- Mock external services (e.g., Prisma, auth, Gemini AI) using `msw` or Vitest mocks
- Use Playwright for e2e tests (post-MVP)

---

## ✍️ Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| **Components** | PascalCase.tsx | `OpportunityCard.tsx`, `KanbanBoard.tsx` |
| **Variables** | camelCase | `opportunities`, `filterText`, `amountArr` |
| **DB Models** | PascalCase | `Opportunity`, `User`, `Account` |
| **Routes** | kebab-case folders | `/opportunities`, `/api/v1/opportunities` |
| **API handlers** | RESTful + HTTP methods | `GET /api/v1/opportunities`, `POST /api/v1/opportunities` |
| **Constants** | UPPER_SNAKE_CASE | `API_BASE_URL`, `DEFAULT_STAGE` |
| **Custom Hooks** | usePascalCase | `useOpportunities`, `useKanbanFilters`, `useDebounce` |
| **Enums** | PascalCase | `OpportunityStage`, `UserRole` |
| **Zod Schemas** | camelCase + "Schema" suffix | `opportunityCreateSchema`, `accountUpdateSchema` |
| **Type Exports** | PascalCase + "Input" or "Data" suffix | `OpportunityCreateInput`, `AccountUpdateInput` |

---

## ⚠️ Avoid

- ❌ No inline CSS or styled-components
- ❌ No use of `any` in TypeScript
- ❌ No console logs in production code (use error tracking instead)
- ❌ No business logic in `page.tsx` files—isolate to helpers, components, or API routes
- ❌ No hardcoded values—use constants, environment variables, or database data
- ❌ **No hardcoded organizationId** - always use authenticated user's organizationId
- ❌ Avoid adding new dependencies without justification
- ❌ Avoid client-side fetching of sensitive data when server-side rendering or API routes can be used
- ❌ Don't use relative imports (`../../lib/utils`) when path aliases (`@/lib/utils`) are available
- ❌ Don't add `"use client"` unnecessarily—default to server components
- ❌ Don't create custom formatters when `/src/lib/format.ts` utilities exist
- ❌ **Never expose cross-org data** - always verify ownership and organizationId

---

## ✅ Output Formatting for Claude

**Always include:**
- The **filename**
- The **relative path** (e.g., `src/app/opportunities/page.tsx`)
- A **brief summary** of what the code does

**Use proper code blocks:**
```tsx
// src/components/kanban/OpportunityCard.tsx
// Displays a single opportunity card with ARR, confidence level, and next steps
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
- "Should this feature be scoped to a specific user (via `ownerId`) or available to all in the organization?"
- "Should this be a server component or client component?"
- "Do you want me to install missing dependencies before proceeding?"
- "What user roles (ADMIN, MANAGER, REP, VIEWER) should have access to this feature?"

---

## 🔍 Claude AI Code Review Checklist

When reviewing code (Claude- or dev-generated), ensure:

✅ **TypeScript safe** (no `any`, proper interfaces used)
✅ **Follows project conventions** (folder structure, naming, path aliases)
✅ **Uses shadcn/ui and Tailwind appropriately**
✅ **Business logic is isolated** from `page.tsx` (moved to `/lib` or components)
✅ **Includes try/catch for async calls**
✅ **Includes Zod validation** where inputs exist
✅ **Reuses existing schemas** (`opportunityCreateSchema`, `accountCreateSchema`, etc.)
✅ **Uses formatting utilities** (`formatCurrencyCompact`, `formatDateShort`, `formatCurrencyInput`)
✅ **Avoids hardcoded values** (uses database, constants, or environment variables)
✅ **Reuses functions or components** (no logic duplication)
✅ **Descriptive prop names and comments** for non-obvious logic
✅ **Fallback UI states** (loading, empty, error)
✅ **No performance bottlenecks** (excessive API calls, unoptimized loops, large state updates)
✅ **No unnecessary dependencies** introduced
✅ **Data is scoped to organization** (queries include `organizationId`)
✅ **User permissions checked** (role-based access control)
✅ **Server components by default** (only uses `"use client"` when necessary)
✅ **API responses match existing format** (`{ opportunities }` or `{ opportunity }`)
✅ **Uses path aliases** (`@/`) instead of relative imports
✅ **Confidence level** (1-5 scale) used instead of deprecated probability field
✅ **Stage names correct** (discovery, demo, validateSolution, decisionMakerApproval, contracting, closedWon, closedLost)

---

## 🌍 Additional Considerations

- **Prepare for internationalization**: Structure strings to support `next-intl` or similar libraries (avoid hardcoded text in components)
- **Support offline functionality** (future): Cache opportunity data locally and sync when online
- **Follow consistent commit message format**: `feat: add opportunity form validation`, `fix: resolve Kanban filter bug`, `refactor: extract Kanban logic to hooks`
- **Use feature branches** for development (e.g., `feature/opportunity-form`, `fix/kanban-drag-drop`)
- **Sales-specific considerations**:
  - Always format ARR as currency using `formatCurrencyCompact` (e.g., `$50K`)
  - Validate confidence level is between 1-5 (handled in Zod schema)
  - Ensure close dates are in the future for open opportunities
  - Use clear stage transitions in UI (e.g., Discovery → Demo → Validate Solution → Decision Maker Approval → Contracting → Closed Won/Lost)
  - Provide audit trails for opportunity updates (use `updatedAt` timestamps)
  - Display owner avatars and names using the `owner` relation
  - Track customer interactions via Gong calls, Granola notes, and Google notes
  - Use AI features to parse meeting notes and generate account research

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
   - Reuse existing utilities like `formatCurrencyCompact`, `formatDateShort`, `formatCurrencyInput`, `parseCurrencyInput`
   - If logic looks similar to an existing function, ask the dev or reuse it

4. **Stick to the UI Design System**
   - Use shadcn/ui components (New York style, Slate base color)
   - Never use raw HTML inputs or create custom styles unless instructed
   - Reuse existing components like `OpportunityCard`, `KanbanBoard`, `KanbanColumn`, `ContactCard`, `AccountForm`

5. **Add Error Handling and Feedback**
   - Always wrap async actions in `try/catch` blocks
   - Display UI feedback (e.g., toast) for success/failure using `sonner`
   - Log and handle edge cases: no data, API failure, invalid auth, etc.
   - Use consistent error response format: `{ error: "message" }`

6. **Multi-Tenancy Discipline**
   - **Always scope queries by `organizationId`** for strict data isolation
   - Check user permissions (ADMIN, MANAGER, REP, VIEWER) before sensitive actions
   - Verify ownership before update/delete operations
   - Never expose cross-org data in API responses or UI

7. **Ask When Ambiguous**
   - If you're not sure what the route should be called, where logic belongs, or what props a component expects, **ask for clarification**
   - If a required dependency is missing, **ask before proceeding**
   - If user permissions are unclear, **ask about role requirements**

---

## 🤖 Subagent Configuration

This project uses specialized subagents for different domains, located in `.claude/agents/`:

### Available Subagents

1. **context-navigator** - Code exploration and architecture understanding
   - **Purpose:** Explore codebase structure, trace data flows, map component relationships
   - **Tools:** Read, Grep, Glob (read-only)
   - **Use cases:** "How does the column template system work?", "Where are opportunities filtered?", "Explain the Kanban architecture"

2. **api-architect** - REST API design and validation patterns
   - **Purpose:** Design, implement, and review API endpoints following project conventions
   - **Tools:** Read, Write, Edit, Grep, Glob
   - **Use cases:** "Design an API for notes", "Review the opportunities endpoint", "Add pagination to the API"

3. **testing-architect** - Testing infrastructure and test generation
   - **Purpose:** Set up Jest/React Testing Library, generate tests for components and APIs
   - **Tools:** Read, Write, Edit, Bash, Grep, Glob
   - **Use cases:** "Set up testing infrastructure", "Generate tests for OpportunityCard", "Test the API routes"

4. **database-expert** - Prisma schema design and query optimization
   - **Purpose:** Design schemas, create migrations, optimize queries, ensure data integrity
   - **Tools:** Read, Write, Edit, Bash, Grep, Glob
   - **Use cases:** "Add a Note model", "Optimize Kanban queries", "Review this migration", "Add indexes for performance"

5. **code-reviewer** - Code quality and pre-commit review specialist
   - **Purpose:** Review code changes for quality, conventions, security, and best practices before committing
   - **Tools:** Read, Grep, Glob (read-only)
   - **Use cases:** "Review my changes", "Check this component before committing", "Review this PR", "Audit code quality"

6. **ux-expert** - UX/UI design and accessibility specialist
   - **Purpose:** Review accessibility (WCAG), visual consistency, responsive design, and sales CRM UX patterns
   - **Tools:** Read, Grep, Glob (read-only)
   - **Use cases:** "Review the Kanban accessibility", "Check responsive design", "Audit form UX", "Review dark mode consistency"

### Using Subagents

**Automatic Delegation:** Claude Code automatically activates the appropriate subagent based on your request:
```
"How does the quarterly view work?" → context-navigator
"Design an API for activity tracking" → api-architect
"Set up Jest for this project" → testing-architect
"Add a new field to Opportunity model" → database-expert
"Review my changes before I commit" → code-reviewer
"Check accessibility on the Kanban board" → ux-expert
```

**Explicit Invocation:** Request a specific subagent directly:
```
"Use the context-navigator to explain the Kanban column system"
"Have the api-architect design the notes endpoints"
"Ask the testing-architect to generate OpportunityForm tests"
"Use the database-expert to add a Note model"
"Use the code-reviewer to check my OpportunityForm component"
"Use the ux-expert to audit the form accessibility"
```

**List Available Subagents:** Use `/agents` command to see all configured subagents

### Subagent Benefits

- **Specialized expertise** - Each agent focuses on specific domain knowledge
- **Consistent patterns** - Agents follow project conventions and best practices
- **Context isolation** - Prevents mixing concerns across different task types
- **Better results** - Domain-specific prompts lead to higher quality outputs

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

# Verification
npm run verify              # Lint + TypeScript + Build

# Scripts
npm run verify-auth         # Verify Supabase auth setup
npm run migrate:fix-orgs    # Run org migration script
```

**File Locations:**
- Prisma schema: `prisma/schema.prisma`
- API routes: `src/app/api/v1/`
- Validation schemas: `src/lib/validations/`
- Utility functions: `src/lib/`
- Type definitions: `src/types/`
- shadcn/ui components: `src/components/ui/`
- Business components: `src/components/`
- **Subagent configurations:** `.claude/agents/`
- **Documentation:** `.claude/` (ARCHITECTURE.md, API.md, PROMPTS.md, INTEGRATIONS.md, MULTI_TENANCY.md)

**Key Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `GOOGLE_AI_API_KEY` - Gemini API key
- `INNGEST_EVENT_KEY` - Inngest key for background jobs

**Important Database Fields:**
- Use `confidenceLevel` (1-5), **not** `probability` (deprecated)
- Use correct stage names: `discovery`, `demo`, `validateSolution`, `decisionMakerApproval`, `contracting`, `closedWon`, `closedLost`
- Always include `organizationId` in all queries
- Link opportunities to accounts via `accountId` (optional)
- Use `ownerId` for user-specific filtering

**User Roles:**
- `ADMIN` - Full org access, can manage settings and users
- `MANAGER` - Can view/edit direct reports' data
- `REP` - Standard user, own data only
- `VIEWER` - Read-only access

---

## 🎯 Quick Reference

**Key Decisions:**
- **"use client"?** Only if you need state, effects, event handlers, or browser APIs. Otherwise use server components.
- **Validation schemas:** See `/src/lib/validations/` - use `*CreateSchema` for POST, `*UpdateSchema` for PATCH
- **Formatting:** Use utilities from `/src/lib/format.ts` - never hardcode currency/date formatting
- **API endpoints:** See [API.md](.claude/API.md) - all routes under `/api/v1/`
- **Permissions:** See [MULTI_TENANCY.md](.claude/MULTI_TENANCY.md) - always scope by `organizationId`

---

**For detailed information, see:**
- Database schema & folder structure → [ARCHITECTURE.md](.claude/ARCHITECTURE.md)
- API endpoints & patterns → [API.md](.claude/API.md)
- AI & external integrations → [INTEGRATIONS.md](.claude/INTEGRATIONS.md)
- Multi-tenancy & permissions → [MULTI_TENANCY.md](.claude/MULTI_TENANCY.md)
- Prompt templates → [reference/PROMPTS.md](.claude/reference/PROMPTS.md) (reference only)
