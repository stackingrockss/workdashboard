# Architecture Documentation

> Complete database schema, folder structure, and data model relationships

---

## 🗄️ Database Schema (Prisma + PostgreSQL)

**Schema:** `opportunity_tracker`
**Source of Truth:** [prisma/schema.prisma](prisma/schema.prisma)

### Core Models

#### Opportunity
The central entity representing a sales opportunity.

**Fields:**
- `id` (String, CUID) - Unique identifier
- `name` (String) - Opportunity name
- `amountArr` (Int) - Annual Recurring Revenue forecast in dollars
- `confidenceLevel` (Int, 1-5) - Confidence in closing (replaces probability)
- `stage` (OpportunityStage enum) - Current sales stage
- `forecastCategory` (ForecastCategory enum) - Pipeline, Best Case, or Forecast
- `closeDate` (DateTime, nullable) - Expected close date
- `nextStep` (String, nullable) - Next action item
- `quarter` (String, nullable) - e.g., "Q1 2025"
- `columnId` (String, nullable) - Flexible Kanban column assignment
- `notes` (String, nullable) - General notes
- `riskNotes` (String, nullable) - Risk assessment notes
- `accountId` (String, nullable, FK) - Link to Account
- `accountName` (String, nullable) - Backward compatibility
- `ownerId` (String, FK) - User who owns this opportunity
- `organizationId` (String, FK) - Organization this belongs to
- `decisionMakers` (String, nullable) - Key decision maker names
- `competition` (String, nullable) - Competing vendors
- `legalReviewStatus` (ReviewStatus enum) - Legal review progress
- `securityReviewStatus` (ReviewStatus enum) - Security review progress
- `businessCaseStatus` (ReviewStatus enum) - Business case status
- `platformType` (PlatformType enum, nullable) - OEM, API, or ISV
- `pinnedToWhiteboard` (Boolean) - Pinned to whiteboard view
- `accountResearch` (Text, nullable) - AI-generated account research
- `accountResearchStatus` (AccountResearchStatus enum, nullable)
- `accountResearchMobile` (Text, nullable) - Mobile-optimized research
- `accountResearchMeta` (JSON, nullable) - Meeting brief metadata
- `accountResearchGeneratedAt` (DateTime, nullable)
- `painPointsHistory` (Text, nullable) - Historical pain points
- `goalsHistory` (Text, nullable) - Historical goals
- `nextStepsHistory` (Text, nullable) - Historical next steps
- `consolidatedPainPoints` (JSON, nullable) - Aggregated from multiple calls
- `consolidatedGoals` (JSON, nullable) - Aggregated from multiple calls
- `consolidatedRiskAssessment` (JSON, nullable) - Aggregated risk data
- `lastConsolidatedAt` (DateTime, nullable)
- `consolidationCallCount` (Int, nullable)
- `parsedGongCallIds` (String[]) - IDs of parsed Gong calls
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `owner` → User (many-to-one)
- `organization` → Organization (many-to-one)
- `account` → Account (many-to-one, optional)
- `contacts` → Contact[] (one-to-many)
- `gongCalls` → GongCall[] (one-to-many)
- `googleNotes` → GoogleNote[] (one-to-many)
- `granolaNotes` → GranolaNote[] (one-to-many)

**Indexes:**
- `organizationId`, `ownerId`, `accountId`, `columnId`, `closeDate`, `pinnedToWhiteboard`

---

#### Account
Company/account entity (separate from opportunities).

**Fields:**
- `id` (String, CUID)
- `name` (String) - Account name
- `website` (String, nullable)
- `industry` (String, nullable)
- `priority` (String, default: "medium")
- `health` (String, default: "good")
- `notes` (String, nullable)
- `ownerId` (String, nullable, FK)
- `organizationId` (String, FK)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `owner` → User (many-to-one, optional)
- `organization` → Organization (many-to-one)
- `contacts` → Contact[] (one-to-many)
- `opportunities` → Opportunity[] (one-to-many)

**Unique Constraint:** `(organizationId, name)`

---

#### Contact
Stakeholder/contact within an account or opportunity.

**Fields:**
- `id` (String, CUID)
- `firstName` (String)
- `lastName` (String)
- `title` (String, nullable)
- `email` (String, nullable)
- `phone` (String, nullable)
- `role` (ContactRole enum) - decision_maker, influencer, champion, blocker, end_user
- `sentiment` (ContactSentiment enum) - advocate, positive, neutral, negative, unknown
- `notes` (String, nullable)
- `opportunityId` (String, nullable, FK)
- `accountId` (String, nullable, FK)
- `managerId` (String, nullable, FK) - For org chart hierarchy
- `positionX` (Float, nullable) - Org chart position
- `positionY` (Float, nullable) - Org chart position
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `opportunity` → Opportunity (many-to-one, optional)
- `account` → Account (many-to-one, optional)
- `manager` → Contact (many-to-one, self-referential)
- `directReports` → Contact[] (one-to-many, self-referential)

---

### Notes & Calls Models

#### GongCall
Gong sales call with optional AI parsing.

**Fields:**
- `id` (String, CUID)
- `opportunityId` (String, FK)
- `title` (String)
- `url` (String) - Link to Gong call
- `meetingDate` (DateTime)
- `noteType` (NoteType enum, default: customer) - customer, internal, prospect
- `transcriptText` (Text, nullable) - Full transcript
- `painPoints` (JSON, nullable) - Parsed pain points
- `goals` (JSON, nullable) - Parsed goals
- `parsedPeople` (JSON, nullable) - Identified attendees
- `nextSteps` (JSON, nullable) - Parsed action items
- `riskAssessment` (JSON, nullable) - AI risk analysis
- `parsedAt` (DateTime, nullable)
- `parsingStatus` (ParsingStatus enum, nullable) - pending, parsing, completed, failed
- `parsingError` (String, nullable)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `opportunity` → Opportunity (many-to-one)

**Indexes:** `opportunityId`, `parsingStatus`

---

#### GranolaNote
Granola meeting note link.

**Fields:**
- `id` (String, CUID)
- `opportunityId` (String, FK)
- `title` (String)
- `url` (String)
- `meetingDate` (DateTime)
- `noteType` (NoteType enum, default: customer)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `opportunity` → Opportunity (many-to-one)

---

#### GoogleNote
Google Doc note link.

**Fields:**
- `id` (String, CUID)
- `opportunityId` (String, FK)
- `title` (String)
- `url` (String)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `opportunity` → Opportunity (many-to-one)

---

### Organization & User Models

#### Organization
Top-level tenant entity.

**Fields:**
- `id` (String, CUID)
- `name` (String)
- `domain` (String, nullable, unique) - Email domain for auto-join
- `logo` (String, nullable)
- `fiscalYearStartMonth` (Int, default: 1) - 1-12 (Jan-Dec)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `users` → User[] (one-to-many)
- `accounts` → Account[] (one-to-many)
- `opportunities` → Opportunity[] (one-to-many)
- `kanbanViews` → KanbanView[] (one-to-many)
- `invitations` → Invitation[] (one-to-many)
- `settings` → OrganizationSettings (one-to-one)

---

#### OrganizationSettings
Settings for an organization.

**Fields:**
- `id` (String, CUID)
- `organizationId` (String, unique, FK)
- `defaultKanbanView` (String, nullable) - Default view ID
- `defaultKanbanTemplateId` (String, nullable)
- `allowSelfSignup` (Boolean, default: false)
- `allowDomainAutoJoin` (Boolean, default: false)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `organization` → Organization (one-to-one)

---

#### User
User within an organization.

**Fields:**
- `id` (String, CUID)
- `email` (String, unique)
- `name` (String, nullable)
- `avatarUrl` (String, nullable)
- `supabaseId` (String, unique, nullable) - Link to Supabase auth
- `role` (UserRole enum) - ADMIN, MANAGER, REP, VIEWER
- `organizationId` (String, nullable, FK)
- `managerId` (String, nullable, FK) - For reporting hierarchy
- `createdAt` (DateTime)

**Relations:**
- `organization` → Organization (many-to-one, optional)
- `manager` → User (many-to-one, self-referential)
- `directReports` → User[] (one-to-many, self-referential)
- `opportunities` → Opportunity[] (one-to-many)
- `ownedAccounts` → Account[] (one-to-many)
- `kanbanViews` → KanbanView[] (one-to-many)
- `invitations` → Invitation[] (one-to-many, as inviter)

**Indexes:** `organizationId`, `managerId`

---

#### Invitation
Pending user invitation to join organization.

**Fields:**
- `id` (String, CUID)
- `email` (String)
- `role` (UserRole enum, default: REP)
- `organizationId` (String, FK)
- `invitedById` (String, FK)
- `token` (String, unique) - Invitation token
- `expiresAt` (DateTime)
- `acceptedAt` (DateTime, nullable)
- `createdAt` (DateTime)

**Relations:**
- `organization` → Organization (many-to-one)
- `invitedBy` → User (many-to-one)

**Unique Constraint:** `(organizationId, email)`

---

### Kanban View Models

#### KanbanView
Saved Kanban board configuration.

**Fields:**
- `id` (String, CUID)
- `name` (String)
- `viewType` (ViewType enum) - custom, quarterly, stages, forecast
- `isActive` (Boolean, default: false) - Currently selected view
- `isDefault` (Boolean, default: false)
- `isShared` (Boolean, default: false) - Shared across org
- `userId` (String, nullable, FK) - Owner (if personal view)
- `organizationId` (String, nullable, FK) - Owner (if shared view)
- `lastAccessedAt` (DateTime, nullable)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `user` → User (many-to-one, optional)
- `organization` → Organization (many-to-one, optional)
- `columns` → KanbanColumn[] (one-to-many)

**Unique Constraints:** `(userId, name)`, `(organizationId, name)`
**Indexes:** `(userId, isActive)`, `(organizationId, isActive)`

---

#### KanbanColumn
Column within a Kanban view.

**Fields:**
- `id` (String, CUID)
- `title` (String)
- `order` (Int) - Display order
- `color` (String, nullable) - Hex color
- `viewId` (String, FK)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relations:**
- `view` → KanbanView (many-to-one)

**Unique Constraint:** `(viewId, order)`

---

## 📐 Enums

### OpportunityStage
```typescript
"discovery" | "demo" | "validateSolution" | "decisionMakerApproval" | "contracting" | "closedWon" | "closedLost"
```

### ForecastCategory
```typescript
"pipeline" | "bestCase" | "forecast"
```

### ReviewStatus
```typescript
"not_started" | "in_progress" | "complete" | "not_applicable"
```

### PlatformType
```typescript
"oem" | "api" | "isv"
```

### AccountResearchStatus
```typescript
"generating" | "completed" | "failed"
```

### ParsingStatus
```typescript
"pending" | "parsing" | "completed" | "failed"
```

### ContactRole
```typescript
"decision_maker" | "influencer" | "champion" | "blocker" | "end_user"
```

### ContactSentiment
```typescript
"advocate" | "positive" | "neutral" | "negative" | "unknown"
```

### UserRole
```typescript
"ADMIN" | "MANAGER" | "REP" | "VIEWER"
```

### ViewType
```typescript
"custom" | "quarterly" | "stages" | "forecast"
```

### NoteType
```typescript
"customer" | "internal" | "prospect"
```

---

## 📁 Folder Structure

```
/work
  /.claude
    CLAUDE.md (main rules + imports)
    ARCHITECTURE.md (this file)
    API.md
    PROMPTS.md
    INTEGRATIONS.md
    MULTI_TENANCY.md
    /agents
      context-navigator.md
      api-architect.md
      testing-architect.md
      database-expert.md
      code-reviewer.md
  /src
    /app
      /api
        /v1
          /opportunities
            route.ts (GET, POST)
            /[id]
              route.ts (GET, PATCH, DELETE)
              /contacts (CRUD for opportunity contacts)
              /gong-calls (CRUD for Gong calls)
              /google-notes (CRUD for Google notes)
              /granola-notes (CRUD for Granola notes)
              /research-status (update research status)
              /consolidate-insights (trigger insight consolidation)
          /accounts (CRUD for accounts)
          /contacts (CRUD for contacts)
          /views (Kanban view CRUD)
          /columns (Column CRUD)
          /users (User management)
          /invitations (Invitation CRUD)
          /organization (Org settings)
          /me (Current user endpoint)
          /settings (User settings)
          /gong-calls (Gong call operations)
          /ai
            /meeting-notes (AI parsing)
            /parse-gong-transcript (transcript parsing)
          /admin (Admin operations)
      /opportunities
        page.tsx (Kanban board)
        loading.tsx
        error.tsx
        /[id]
          page.tsx (Opportunity detail)
          loading.tsx
          error.tsx
      /prospects
        page.tsx (Prospects/accounts table)
        /[id]
          page.tsx (Account detail)
      /deal-updates
        page.tsx (Deal updates feed)
      /key-deal-review
        page.tsx (Key deals review)
      /settings
        page.tsx (Settings home)
        /organization
          page.tsx (Org settings)
      /users
        page.tsx (User management)
      /auth
        /login
          page.tsx
          actions.ts
      layout.tsx (root layout with auth)
      page.tsx (dashboard/home)
      globals.css
    /components
      /kanban
        KanbanBoard.tsx
        KanbanBoardWrapper.tsx (client wrapper)
        KanbanColumn.tsx
        OpportunityCard.tsx
        DraggableOpportunityCard.tsx (drag-and-drop wrapper)
        ColumnTemplateDialog.tsx (apply templates)
        ManageViewsDialog.tsx (view management)
        WelcomeViewDialog.tsx (first-time setup)
      /contacts
        ContactCard.tsx
        ContactList.tsx
        OrgChartNode.tsx (org chart visualization)
        OrgChartSection.tsx
        OrgChartView.tsx
      /whiteboard
        WhiteboardTable.tsx (pinned opportunities table)
      /auth
        GoogleSignInButton.tsx
      /forms
        opportunity-form.tsx
        account-form.tsx
        contact-form.tsx
        column-form.tsx
      /features
        /opportunities
          opportunity-detail-client.tsx
          google-notes-section.tsx
        /prospects
          prospect-detail-client.tsx
          prospect-actions.tsx
        /users
          user-management-client.tsx
          invite-user-dialog.tsx
          edit-user-dialog.tsx
          delete-user-dialog.tsx
        /settings
          organization-settings-client.tsx
      /ui (shadcn/ui components)
        button.tsx
        card.tsx
        dialog.tsx
        tabs.tsx
        dropdown-menu.tsx
        tooltip.tsx
        input.tsx
        textarea.tsx
        select.tsx
        label.tsx
        badge.tsx
        avatar.tsx
        separator.tsx
        skeleton.tsx
        scroll-area.tsx
        checkbox.tsx
        table.tsx
        switch.tsx
        alert-dialog.tsx
        currency-input.tsx (custom component)
        inline-editable.tsx (custom component)
    /lib
      /api (API helper functions)
        accounts.ts
        gong-calls.ts
        google-notes.ts
        granola-notes.ts
        users.ts
      /validations (Zod schemas)
        opportunity.ts
        account.ts
        contact.ts
        user.ts
        organization.ts
        invitation.ts
        view.ts
        column.ts
        google-note.ts
        granola-note.ts
        gong-call.ts
      /templates
        column-templates.ts (Kanban view templates)
      /utils
        quarter.ts (quarter calculation utilities)
        quarterly-view.ts (quarterly Kanban helpers)
      db.ts (Prisma singleton)
      utils.ts (cn, clsx helper)
      format.ts (currency & date formatting)
    /types
      opportunity.ts
      account.ts
      contact.ts
      organization.ts
      invitation.ts
      permissions.ts
      view.ts
      google-note.ts
      granola-note.ts
      gong-call.ts
    /hooks
      (create as needed)
      useDebounce.ts
      useOpportunities.ts
  /prisma
    schema.prisma
    /migrations
  /public
    /images
  /scripts
    verify-auth-setup.mjs
    fix-opportunity-organizations.ts
```

---

## 📊 Data Model Relationships

### Hierarchy

```
Organization (tenant root)
  ├─ Users (ADMIN, MANAGER, REP, VIEWER)
  │   ├─ Manager → DirectReports (self-referential)
  │   ├─ Owned Opportunities
  │   ├─ Owned Accounts
  │   └─ Personal Kanban Views
  ├─ Accounts (companies)
  │   ├─ Contacts (stakeholders)
  │   └─ Opportunities (sales opportunities)
  │       ├─ Contacts (opportunity-specific)
  │       ├─ Gong Calls (with AI parsing)
  │       ├─ Granola Notes
  │       └─ Google Notes
  ├─ Shared Kanban Views
  │   └─ Columns
  ├─ Invitations (pending users)
  └─ Organization Settings
```

### Key Relationships

**Organization ↔ Everything:**
All core entities (Opportunity, Account, User) have `organizationId` for strict tenant isolation.

**User Hierarchy:**
- Users can have a `managerId` (reporting structure)
- Users own Opportunities and Accounts via `ownerId`
- Users create personal or shared Kanban Views

**Account → Opportunities → Contacts:**
- Accounts represent companies
- Opportunities are sales deals tied to an Account (optional)
- Contacts can belong to an Account OR an Opportunity (or both)

**Opportunity → Notes:**
- One Opportunity can have many Gong Calls, Granola Notes, Google Notes
- Notes track customer conversations and meetings

**Kanban Views:**
- Can be personal (`userId` set) or shared (`organizationId` set)
- Contain Columns with custom titles, colors, and order
- Opportunities assigned via `columnId`

---

## 🔍 Query Patterns

### Scoping Rules

**Always scope by `organizationId`:**
```typescript
await prisma.opportunity.findMany({
  where: { organizationId: user.organizationId }
});
```

**User-specific filtering:**
```typescript
await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId,
    ownerId: user.id, // Only this user's opportunities
  }
});
```

**Include relations:**
```typescript
await prisma.opportunity.findUnique({
  where: { id },
  include: {
    owner: true,
    account: true,
    contacts: true,
    gongCalls: { orderBy: { meetingDate: 'desc' } },
    granolaNotes: { orderBy: { meetingDate: 'desc' } },
    googleNotes: { orderBy: { createdAt: 'desc' } },
  }
});
```

---

## 🏗️ Path Aliases

Configured in `tsconfig.json` and `components.json`:

```typescript
import { Button } from "@/components/ui/button";          // → src/components/ui/button
import { formatCurrency } from "@/lib/format";            // → src/lib/format
import { Opportunity } from "@/types/opportunity";        // → src/types/opportunity
import { prisma } from "@/lib/db";                        // → src/lib/db
import { opportunityCreateSchema } from "@/lib/validations/opportunity"; // → src/lib/validations/opportunity
```

**Always use `@/` path aliases** instead of relative imports (`../../`).
