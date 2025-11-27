# Prompt Templates

> Ready-to-use prompts for common development tasks

---

## 🧱 Scaffold a Page

```
Create a new page component for the route `/dashboard`. It should:
- Display key sales metrics (total ARR, win rate, deals in pipeline)
- Fetch data from the database via Prisma (server component)
- Use shadcn/ui Card components for metrics
- Use Tailwind for responsive layout
- Handle loading and error states
- Use formatCurrencyCompact for ARR display
- Scope all queries by organizationId
```

---

## 🧪 Create a Form with Validation

```
Build an `OpportunityForm.tsx` component. It should:
- Allow users to create/edit an opportunity with fields: name, accountId (or account name), amountArr, confidenceLevel, nextStep, closeDate, stage
- Use React Hook Form + Zod for validation
- Reuse opportunityCreateSchema from /src/lib/validations/opportunity.ts
- Display inline errors for each field
- Use shadcn/ui components (Input, Select, Button, DatePicker)
- On submit, send data to `/api/v1/opportunities` via POST
- Show a success toast on completion (using sonner)
- Make it a client component ("use client")
```

---

## 🔐 Protect a Page with Auth

```
Wrap the `/opportunities` page so it only renders if the user is authenticated.
- If not authenticated, redirect to `/auth/login`
- Use Supabase SSR client to get the session
- Verify user has an organizationId
- Pass `session.user.id` to look up the user
- Keep the page as a server component
- Scope all Prisma queries by user.organizationId
```

---

## 🔎 Create a Reusable Component

```
Create an `OpportunityCard.tsx` component that accepts:
- `opportunity: Opportunity` (matching the type from /src/types/opportunity.ts)
- `onOpen?: (id: string) => void` callback (optional, makes it a client component)
- Displays: name, account name, ARR (formatted with formatCurrencyCompact), confidenceLevel, stage badge, close date (formatted with formatDateShort)
- Has a "View Details" button that triggers `onOpen` if provided
- Uses shadcn/ui Card and Badge components
- Responsive and styled with Tailwind
- Only add "use client" if onOpen is provided
```

---

## 📊 Generate a Dashboard Chart

```
Create a chart component that shows total ARR by stage.
- Use Recharts library (already installed)
- Fetch opportunity data grouped by stage (server component)
- X-axis: stage name (use getStageLabel helper from /src/types/opportunity.ts)
- Y-axis: total ARR (formatted as currency)
- Title: "Pipeline by Stage"
- Responsive and styled with Tailwind
- Scope query by organizationId
```

---

## ⚙️ Add API Endpoint

```
Create a `GET /api/v1/opportunities/stats` API route that returns:
- Total number of opportunities
- Total ARR across all stages
- Win rate (closedWon / (closedWon + closedLost))
- Average deal size
- Validate user session (Supabase)
- Scope all queries to user.organizationId
- Return JSON in format: { stats: { total, totalArr, winRate, avgDealSize } }
- Include proper error handling with try/catch
- Use HTTP status codes correctly (200, 401, 500)
```

---

## 🧪 Unit Test a Component

```
Write a Jest test for the `OpportunityCard.tsx` component.
- Mock a sample `Opportunity` object (with all required fields including owner)
- Check that the opportunity name, account name, and ARR render correctly
- Verify the ARR uses formatCurrencyCompact
- Verify the close date uses formatDateShort
- Ensure the stage badge displays the correct text using getStageLabel
- Test that clicking "View Details" triggers the `onOpen` callback
- Use React Testing Library for rendering and queries
```

---

## 🧩 Update an Existing Component

```
Update the `KanbanBoard.tsx` component to:
- Add a dropdown filter for "My Opportunities" vs. "All Opportunities"
- Update the filtering logic to support `ownerId` filtering
- Ensure TypeScript types are updated
- Use shadcn/ui DropdownMenu component
- Maintain existing search functionality
- Ensure all queries are scoped by organizationId
- Include tests for the new filter
```

---

## 🗄️ Update Prisma Schema

```
Update `prisma/schema.prisma` to add a new model or field:
- Add a `Note` model with fields for `id`, `content`, `opportunityId`, `authorId`, `createdAt`
- Add a relation to the `Opportunity` model (notes: Note[])
- Generate and apply migrations using `npx prisma migrate dev --name add-notes`
- Run `npx prisma generate` to update Prisma Client
- Update related API routes and types in `/src/types`
- Create Zod validation schema in `/src/lib/validations/note.ts`
- Ensure cascade delete when opportunity is deleted
- Use opportunity_tracker schema
```

---

## 🪝 Create a Custom Hook

```
Create a `useDebounce` custom hook in `/src/hooks/useDebounce.ts`:
- Accept a value and delay (ms)
- Return the debounced value
- Use TypeScript generics for type safety
- Include JSDoc comments with usage example
- Mark as "use client" since it uses React hooks
```

---

## 🏢 Create Multi-Tenant Feature

```
Implement user invitation flow:
1. Create `InviteUserDialog.tsx` component:
   - Form with email and role (ADMIN, MANAGER, REP, VIEWER) fields
   - Use React Hook Form + Zod
   - POST to `/api/v1/invitations`
   - Show success toast with invitation link

2. Create API route `POST /api/v1/invitations`:
   - Validate input with invitationCreateSchema
   - Check user has ADMIN or MANAGER role
   - Generate unique token
   - Set expiration (7 days)
   - Create invitation record
   - Return invitation with token

3. Create invitation acceptance page `/auth/accept-invitation/[token]`:
   - Verify token is valid and not expired
   - Create user account with Supabase
   - Link user to organization
   - Redirect to `/opportunities`

Ensure all queries scope by organizationId.
```

---

## 🎨 Style a Component with Tailwind

```
Style the `OpportunityCard` component with Tailwind:
- Card should have white background (dark:bg-slate-800 in dark mode)
- Add subtle shadow and hover effect (hover:shadow-lg transition)
- Display opportunity name as heading (text-lg font-semibold)
- Show ARR prominently (text-2xl font-bold text-green-600)
- Use badge component for stage (with stage-specific colors)
- Add close date with calendar icon from lucide-react
- Make responsive: stack on mobile, horizontal on desktop
- Ensure all text is readable in dark mode
```

---

## 🔗 Add External Integration

```
Integrate Gong call tracking:
1. Create `GongCallForm.tsx` component:
   - Fields: title, url, meetingDate, noteType
   - Validate URL is from gong.io
   - POST to `/api/v1/opportunities/[id]/gong-calls`

2. Create API route `POST /api/v1/opportunities/[id]/gong-calls`:
   - Validate with gongCallCreateSchema
   - Create GongCall record
   - Set parsingStatus to 'pending'
   - Trigger background job to parse transcript (if transcriptText provided)
   - Return created call

3. Add GongCallList component:
   - Display all Gong calls for opportunity
   - Show parsing status (pending, parsing, completed, failed)
   - Show retry button for failed parses
   - Display parsed pain points, goals, next steps when available

Ensure all queries scope by organizationId and verify opportunity ownership.
```

---

## 🤖 Add AI Feature

```
Implement AI account research generation:
1. Add "Generate Research" button to opportunity detail page
2. On click:
   - PATCH `/api/v1/opportunities/[id]` with accountResearchStatus: 'generating'
   - Call background job to generate research using Gemini
   - Poll for completion or use WebSocket for real-time updates

3. Create background job (Inngest function):
   - Fetch account data (website, industry, etc.)
   - Use @google/generative-ai to generate research
   - Store in opportunity.accountResearch field
   - Update accountResearchStatus to 'completed'
   - Set accountResearchGeneratedAt timestamp

4. Display research in expandable section:
   - Use react-markdown to render formatted content
   - Show generation timestamp
   - Add "Regenerate" button

Ensure Gemini API key is in environment variables.
```

---

## 📱 Make Component Responsive

```
Make the KanbanBoard component responsive:
- Desktop (2xl): 6 columns side-by-side
- Laptop (xl): 4 columns
- Tablet (md): 2 columns
- Mobile: 1 column (stack vertically)
- Use horizontal scroll on mobile if columns overflow
- Ensure drag-and-drop works on touch devices
- Hide "Add Column" button on small screens (show in menu instead)
- Make opportunity cards stack better on mobile (larger touch targets)
```

---

## 🔍 Add Search Functionality

```
Add search to the opportunities list:
1. Create search input component:
   - Use shadcn/ui Input with search icon
   - Debounce input (300ms) using useDebounce hook
   - Filter opportunities by name, account name, or notes

2. Update opportunities query:
   - Add `where` clause with `OR` conditions
   - Use Prisma's `contains` for case-insensitive search
   - Maintain organizationId scoping

3. Show results count:
   - Display "X opportunities found" below search
   - Show "No results" state if empty

4. Add keyboard shortcuts:
   - Cmd/Ctrl + K to focus search
   - Escape to clear search
```

---

## 📧 Add Email Notification

```
Implement opportunity close date reminder:
1. Create Inngest scheduled function:
   - Run daily at 9am
   - Find opportunities with closeDate in next 7 days
   - Where stage is not closedWon or closedLost

2. For each opportunity:
   - Get owner's email
   - Generate email with opportunity details
   - Use Resend or SendGrid to send email
   - Include link to opportunity detail page

3. Add user preference:
   - Allow users to opt-in/opt-out of reminders
   - Store preference in UserSettings model
   - Check preference before sending

Ensure emails are scoped by organization and respect user preferences.
```

---

## 🎯 Optimize Performance

```
Optimize the KanbanBoard component for large datasets:
1. Implement virtualization:
   - Use @tanstack/react-virtual for column scrolling
   - Render only visible cards in viewport
   - Add loading indicators for lazy-loaded cards

2. Add data caching:
   - Use React Query or SWR for opportunity data
   - Cache for 5 minutes
   - Implement optimistic updates on drag-and-drop

3. Optimize database queries:
   - Add database indexes on frequently queried fields
   - Use `select` to fetch only needed fields
   - Batch related queries with `include`

4. Add pagination:
   - Load 50 opportunities per page
   - Implement infinite scroll or "Load More" button

5. Memoize components:
   - Use React.memo for OpportunityCard
   - Use useMemo for filtered/sorted data
   - Use useCallback for event handlers
```

---

## 🛠️ Debug an Issue

```
Debug why opportunities are not filtering by stage:
1. Check component state:
   - Add console.log in filter function
   - Verify stage value matches enum (discovery, demo, etc.)
   - Check if stage is being passed to API correctly

2. Check API route:
   - Log the `where` clause in Prisma query
   - Verify stage is in OpportunityStage enum
   - Check if organizationId scoping is correct

3. Check database:
   - Use Prisma Studio to verify stage values
   - Check if any opportunities have null stage
   - Verify enum values match schema definition

4. Add error handling:
   - Wrap filter logic in try/catch
   - Show toast notification on error
   - Log full error to console

5. Test with different stages:
   - Try each stage value individually
   - Check if issue is with specific stage
```

---

## 📦 Prepare for Deployment

```
Prepare the app for production deployment on Vercel:
1. Environment variables:
   - Add all required env vars to Vercel dashboard
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - DATABASE_URL
   - GOOGLE_AI_API_KEY
   - INNGEST_EVENT_KEY

2. Database:
   - Run all pending migrations on production database
   - Generate Prisma client with `npx prisma generate`
   - Verify connection with `npx prisma db pull`

3. Build configuration:
   - Ensure `npm run build` succeeds locally
   - Check for TypeScript errors with `tsc --noEmit`
   - Run linter with `npm run lint`

4. Performance:
   - Add `loading.tsx` for all routes
   - Ensure images use Next.js Image component
   - Add metadata to all pages (title, description)

5. Monitoring:
   - Add Vercel Analytics
   - Set up error tracking (Sentry)
   - Configure logging
```

---

## 🔄 Migrate Data

```
Create data migration script to update all opportunities:
1. Create script `/scripts/migrate-confidence-levels.ts`:
   - Fetch all opportunities with probability field (deprecated)
   - Convert probability (0-100) to confidenceLevel (1-5):
     - 0-20% → 1
     - 21-40% → 2
     - 41-60% → 3
     - 61-80% → 4
     - 81-100% → 5
   - Update each opportunity with new confidenceLevel
   - Log progress and errors

2. Add dry-run mode:
   - Show what would change without updating
   - Add `--dry-run` flag

3. Add backup:
   - Export current data to JSON before migration
   - Store in `/backups/` directory

4. Run migration:
   - `npm run migrate:confidence-levels`
   - Verify results with Prisma Studio
   - Test app functionality after migration

Ensure script is idempotent (can run multiple times safely).
```
