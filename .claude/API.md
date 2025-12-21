# API Documentation

> Complete REST API structure, validation patterns, and response formats

---

## 🚀 API Overview

**Base Path:** `/api/v1`
**Versioning:** All routes versioned under `/v1/` for future compatibility
**Auth:** Supabase session-based authentication
**Scoping:** All queries scoped by `organizationId` (+ `ownerId` where applicable)

---

## 📋 API Endpoint Structure

### Opportunities

#### `GET /api/v1/opportunities`
**Description:** List all opportunities with optional filtering

**Query Parameters:**
- `ownerId` (optional) - Filter by owner
- `stage` (optional) - Filter by stage
- `columnId` (optional) - Filter by Kanban column
- `pinnedToWhiteboard` (optional) - Filter pinned opportunities
- `skip` (optional) - Pagination offset
- `take` (optional) - Pagination limit (default: 100)

**Response:**
```json
{
  "opportunities": [
    {
      "id": "cuid",
      "name": "Acme Corp Expansion",
      "amountArr": 150000,
      "confidenceLevel": 4,
      "stage": "validateSolution",
      "closeDate": "2025-03-15",
      "accountId": "cuid",
      "accountName": "Acme Corp",
      "organizationId": "cuid",
      "ownerId": "cuid",
      "owner": {
        "id": "cuid",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "avatarUrl": "https://..."
      },
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-10T00:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized (no session)
- `500` - Server error

---

#### `POST /api/v1/opportunities`
**Description:** Create a new opportunity

**Request Body:** See `opportunityCreateSchema` in `/src/lib/validations/opportunity.ts`
- Required: `name`, `amountArr`, `confidenceLevel`, `stage`, `closeDate`
- Optional: `accountId`, `nextStep`, `forecastCategory`, `notes`, `ownerId` (defaults to current user)

**Response:** `201` with `{ opportunity: { ... } }`

**Status Codes:** `201` Created | `400` Validation error | `401` Unauthorized | `500` Server error

---

#### `GET /api/v1/opportunities/[id]`
**Description:** Get a single opportunity by ID

**Response:**
```json
{
  "opportunity": {
    /* full opportunity with relations */
    "owner": { /* owner data */ },
    "account": { /* account data */ },
    "contacts": [ /* contact array */ ],
    "gongCalls": [ /* gong calls array */ ],
    "granolaNotes": [ /* granola notes array */ ],
    "googleNotes": [ /* google notes array */ ]
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `403` - Forbidden (not in user's organization)
- `404` - Opportunity not found
- `500` - Server error

---

#### `PATCH /api/v1/opportunities/[id]`
**Description:** Update an opportunity

**Request Body:** Partial `Opportunity` object (any fields from `opportunityUpdateSchema`)

**Validation:** Uses `opportunityUpdateSchema` from `/src/lib/validations/opportunity.ts`

**Response:**
```json
{
  "opportunity": { /* updated opportunity */ }
}
```

**Status Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not found
- `500` - Server error

---

#### `DELETE /api/v1/opportunities/[id]`
**Description:** Delete an opportunity (cascade deletes contacts, notes, calls)

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not found
- `500` - Server error

---

### Opportunity Sub-Resources

#### `GET /api/v1/opportunities/[id]/contacts`
List contacts for an opportunity

#### `POST /api/v1/opportunities/[id]/contacts`
Create a contact for an opportunity

#### `POST /api/v1/opportunities/[id]/contacts/bulk`
Create multiple contacts at once

#### `PATCH /api/v1/opportunities/[id]/contacts/[contactId]`
Update a contact

#### `DELETE /api/v1/opportunities/[id]/contacts/[contactId]`
Delete a contact

---

#### `GET /api/v1/opportunities/[id]/gong-calls`
List Gong calls for an opportunity

#### `POST /api/v1/opportunities/[id]/gong-calls`
Create a Gong call link

**Request Body:**
```json
{
  "title": "Discovery Call with Acme",
  "url": "https://app.gong.io/call?id=...",
  "meetingDate": "2025-01-15T14:00:00Z",
  "noteType": "customer",
  "transcriptText": "Full transcript..." // Optional
}
```

#### `DELETE /api/v1/opportunities/[id]/gong-calls/[callId]`
Delete a Gong call

---

#### `GET /api/v1/opportunities/[id]/granola-notes`
List Granola notes for an opportunity

#### `POST /api/v1/opportunities/[id]/granola-notes`
Create a Granola note link

**Request Body:**
```json
{
  "title": "QBR with Acme",
  "url": "https://granola.so/notes/...",
  "meetingDate": "2025-01-20T10:00:00Z",
  "noteType": "customer"
}
```

#### `DELETE /api/v1/opportunities/[id]/granola-notes/[noteId]`
Delete a Granola note

---

#### `GET /api/v1/opportunities/[id]/google-notes`
List Google notes for an opportunity

#### `POST /api/v1/opportunities/[id]/google-notes`
Create a Google note link

**Request Body:**
```json
{
  "title": "Acme Requirements Doc",
  "url": "https://docs.google.com/document/d/..."
}
```

#### `DELETE /api/v1/opportunities/[id]/google-notes/[noteId]`
Delete a Google note

---

#### `PATCH /api/v1/opportunities/[id]/research-status`
Update account research status (used by AI generation jobs)

**Request Body:**
```json
{
  "status": "generating" | "completed" | "failed"
}
```

---

#### `POST /api/v1/opportunities/[id]/consolidate-insights`
Manually trigger consolidation of insights from parsed Gong calls

**Response:**
```json
{
  "opportunity": { /* opportunity with updated consolidated fields */ }
}
```

---

### Accounts

#### `GET /api/v1/accounts`
List all accounts (with optional filters)

**Query Parameters:**
- `ownerId` (optional)
- `skip`, `take` (pagination)

**Response:**
```json
{
  "accounts": [ /* array of accounts */ ]
}
```

---

#### `POST /api/v1/accounts`
Create a new account

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "website": "https://acme.com",
  "industry": "Technology",
  "priority": "high",
  "health": "good",
  "notes": "Warm lead from conference",
  "ownerId": "cuid" // Optional
}
```

**Validation:** Uses `accountCreateSchema` from `/src/lib/validations/account.ts`

---

#### `GET /api/v1/accounts/[id]`
Get a single account with relations (contacts, opportunities)

---

#### `PATCH /api/v1/accounts/[id]`
Update an account

---

#### `DELETE /api/v1/accounts/[id]`
Delete an account (cascade deletes contacts and opportunities)

---

#### `POST /api/v1/accounts/[id]/convert`
Convert an account into an opportunity

**Request Body:**
```json
{
  "name": "Acme Corp Deal",
  "amountArr": 100000,
  "closeDate": "2025-06-30",
  "stage": "discovery",
  "confidenceLevel": 3
}
```

**Response:**
```json
{
  "opportunity": { /* newly created opportunity linked to account */ }
}
```

---

#### `GET /api/v1/accounts/[id]/contacts`
List contacts for an account

#### `POST /api/v1/accounts/[id]/contacts`
Create a contact for an account

#### `PATCH /api/v1/accounts/[id]/contacts/[contactId]`
Update an account contact

#### `DELETE /api/v1/accounts/[id]/contacts/[contactId]`
Delete an account contact

---

### Kanban Views

#### `GET /api/v1/views`
List Kanban views (personal + shared)

**Query Parameters:**
- `userId` (optional) - Filter by user
- `organizationId` (optional) - Filter by organization
- `isActive` (optional) - Filter active views

**Response:**
```json
{
  "views": [
    {
      "id": "cuid",
      "name": "My Sales Pipeline",
      "viewType": "custom",
      "isActive": true,
      "isDefault": false,
      "isShared": false,
      "userId": "cuid",
      "columns": [
        {
          "id": "cuid",
          "title": "Discovery",
          "order": 0,
          "color": "#3b82f6"
        }
      ]
    }
  ]
}
```

---

#### `POST /api/v1/views`
Create a new Kanban view

**Request Body:**
```json
{
  "name": "Q1 2025 Pipeline",
  "viewType": "custom",
  "isShared": false,
  "columns": [
    { "title": "Prospecting", "order": 0, "color": "#ef4444" },
    { "title": "Qualified", "order": 1, "color": "#f59e0b" },
    { "title": "Proposal", "order": 2, "color": "#10b981" }
  ]
}
```

**Validation:** Uses `viewCreateSchema` from `/src/lib/validations/view.ts`

---

#### `GET /api/v1/views/[id]`
Get a single view with columns

---

#### `PATCH /api/v1/views/[id]`
Update a view (name, isShared, etc.)

---

#### `DELETE /api/v1/views/[id]`
Delete a view (cascade deletes columns)

---

#### `POST /api/v1/views/[id]/activate`
Set a view as the active view (deactivates others)

**Response:**
```json
{
  "view": { /* activated view */ }
}
```

---

#### `POST /api/v1/views/[id]/duplicate`
Duplicate a view (creates a copy with new columns)

**Request Body:**
```json
{
  "name": "Q2 2025 Pipeline"
}
```

---

#### `POST /api/v1/views/deactivate-all`
Deactivate all views for the current user

---

### Kanban Columns

#### `GET /api/v1/columns`
List columns (usually via `/api/v1/views/[id]` instead)

#### `POST /api/v1/columns`
Create a new column for a view

**Request Body:**
```json
{
  "viewId": "cuid",
  "title": "Negotiation",
  "order": 3,
  "color": "#8b5cf6"
}
```

**Validation:** Uses `columnCreateSchema` from `/src/lib/validations/column.ts`

---

#### `PATCH /api/v1/columns/[id]`
Update a column (title, order, color)

---

#### `DELETE /api/v1/columns/[id]`
Delete a column

---

### Users

#### `GET /api/v1/users`
List users in the current organization

**Query Parameters:**
- `role` (optional) - Filter by role (ADMIN, MANAGER, REP, VIEWER)

**Response:**
```json
{
  "users": [
    {
      "id": "cuid",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "REP",
      "organizationId": "cuid",
      "managerId": "cuid",
      "avatarUrl": "https://...",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Permissions:** Requires ADMIN or MANAGER role

---

#### `GET /api/v1/users/[id]`
Get a single user

---

#### `PATCH /api/v1/users/[id]`
Update a user (name, role, managerId)

**Request Body:**
```json
{
  "name": "Jane Smith",
  "role": "MANAGER",
  "managerId": "cuid"
}
```

**Validation:** Uses `userUpdateSchema` from `/src/lib/validations/user.ts`

**Permissions:** Requires ADMIN role (or MANAGER for limited updates)

---

#### `DELETE /api/v1/users/[id]`
Delete a user (soft delete or reassign data first)

**Permissions:** Requires ADMIN role

---

### Invitations

#### `GET /api/v1/invitations`
List pending invitations for the organization

**Permissions:** Requires ADMIN or MANAGER role

---

#### `POST /api/v1/invitations`
Create a new invitation

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "role": "REP"
}
```

**Validation:** Uses `invitationCreateSchema` from `/src/lib/validations/invitation.ts`

**Response:**
```json
{
  "invitation": {
    "id": "cuid",
    "email": "newuser@example.com",
    "token": "unique-token",
    "expiresAt": "2025-01-15T00:00:00Z"
  }
}
```

**Permissions:** Requires ADMIN or MANAGER role

---

#### `POST /api/v1/invitations/accept`
Accept an invitation (creates user account)

**Request Body:**
```json
{
  "token": "unique-token"
}
```

**Response:**
```json
{
  "user": { /* newly created user */ }
}
```

---

#### `DELETE /api/v1/invitations/[id]`
Revoke an invitation

**Permissions:** Requires ADMIN or MANAGER role

---

### Organization

#### `GET /api/v1/organization`
Get current user's organization details

**Response:**
```json
{
  "organization": {
    "id": "cuid",
    "name": "Acme Sales",
    "domain": "acmesales.com",
    "fiscalYearStartMonth": 1,
    "logo": "https://...",
    "settings": {
      "defaultKanbanView": "cuid",
      "allowSelfSignup": false,
      "allowDomainAutoJoin": true
    }
  }
}
```

---

#### `PATCH /api/v1/organization`
Update organization details

**Request Body:**
```json
{
  "name": "Acme Sales Team",
  "fiscalYearStartMonth": 4,
  "logo": "https://..."
}
```

**Validation:** Uses `organizationUpdateSchema` from `/src/lib/validations/organization.ts`

**Permissions:** Requires ADMIN role

---

#### `GET /api/v1/organization/settings`
Get organization settings

---

#### `PATCH /api/v1/organization/settings`
Update organization settings

**Request Body:**
```json
{
  "defaultKanbanView": "cuid",
  "allowSelfSignup": true,
  "allowDomainAutoJoin": false
}
```

**Permissions:** Requires ADMIN role

---

### Current User

#### `GET /api/v1/me`
Get current authenticated user

**Response:**
```json
{
  "user": {
    "id": "cuid",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "role": "REP",
    "organizationId": "cuid",
    "organization": { /* org details */ },
    "manager": { /* manager details */ }
  }
}
```

---

### Gong Calls

#### `POST /api/v1/gong-calls/[id]/retry-parsing`
Retry parsing a failed Gong call transcript

**Response:**
```json
{
  "gongCall": {
    "id": "cuid",
    "parsingStatus": "pending"
  }
}
```

---

#### `POST /api/v1/gong-calls/[id]/analyze-risk`
Trigger AI risk analysis for a Gong call

**Response:**
```json
{
  "gongCall": {
    "id": "cuid",
    "riskAssessment": { /* AI-generated risk data */ }
  }
}
```

---

### AI Endpoints

#### `POST /api/v1/ai/meeting-notes`
Parse meeting notes using AI (Gemini)

**Request Body:**
```json
{
  "noteText": "Full meeting transcript or notes...",
  "opportunityId": "cuid"
}
```

**Response:**
```json
{
  "painPoints": ["Issue 1", "Issue 2"],
  "goals": ["Goal 1", "Goal 2"],
  "nextSteps": ["Action 1", "Action 2"],
  "people": ["John Doe", "Jane Smith"]
}
```

---

#### `POST /api/v1/ai/parse-gong-transcript`
Parse a Gong call transcript (called by background jobs)

**Request Body:**
```json
{
  "gongCallId": "cuid",
  "transcriptText": "Full transcript..."
}
```

**Response:**
```json
{
  "gongCall": {
    "id": "cuid",
    "parsingStatus": "completed",
    "painPoints": [...],
    "goals": [...],
    "nextSteps": [...],
    "riskAssessment": { /* risk data */ }
  }
}
```

---

### Admin

#### `POST /api/v1/admin/retry-stuck-parsing`
Retry all stuck parsing jobs (parsingStatus = 'parsing' for > 10 minutes)

**Response:**
```json
{
  "retriedCount": 5
}
```

**Permissions:** Requires ADMIN role

---

## 🔐 Authentication & Authorization

### Session Management

All API routes check for Supabase session:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies }
);

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Organization Scoping

All queries must be scoped by `organizationId`:

```typescript
const user = await prisma.user.findUnique({
  where: { supabaseId: session.user.id },
  include: { organization: true }
});

if (!user?.organizationId) {
  return NextResponse.json({ error: 'User not in an organization' }, { status: 403 });
}

// All queries MUST include organizationId
const opportunities = await prisma.opportunity.findMany({
  where: {
    organizationId: user.organizationId, // REQUIRED
  }
});
```

### Role-Based Access Control

Check user role for admin/manager-only endpoints:

```typescript
if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## ✅ Response Formats

### Success (List)
```json
{
  "opportunities": [ /* array */ ]
}
```

### Success (Single)
```json
{
  "opportunity": { /* object */ }
}
```

### Created
```json
{
  "opportunity": { /* created object */ }
}
```
**Status:** `201`

### Success (Delete/Update)
```json
{
  "success": true
}
```

### Error
```json
{
  "error": "Invalid input"
}
```
**Status:** `400`, `401`, `403`, `404`, or `500`

### Validation Error (Zod)
```json
{
  "error": {
    "formErrors": [],
    "fieldErrors": {
      "amountArr": ["Amount must be a positive number"],
      "closeDate": ["Close date is required"]
    }
  }
}
```
**Status:** `400`

---

## 🔧 Validation Patterns

All API routes validate input with Zod schemas from `/src/lib/validations/`.

**Standard API Route Pattern:**
1. Authenticate session (Supabase)
2. Get user with `organizationId`
3. Parse/validate input with Zod schema (`.safeParse()`)
4. Scope query by `organizationId`
5. Check permissions (role, ownership)
6. Execute database operation
7. Return JSON response

**Error Responses:**
- `400` - Validation error: `{ error: zodError.flatten() }`
- `401` - Unauthorized: `{ error: "Unauthorized" }`
- `403` - Forbidden: `{ error: "Forbidden" }`
- `404` - Not found: `{ error: "Not found" }`
- `500` - Server error: `{ error: "Internal server error" }`

See existing API routes in `src/app/api/v1/` for implementation examples.

---

## 📊 Pagination

**Briefcase API supports opt-in pagination** - endpoints return all data by default (legacy mode) and only paginate when query parameters are present.

### Query Parameters

- `page` - Page number (1-indexed, defaults to 1)
- `limit` - Items per page (max 500, defaults vary by endpoint)

### Endpoints with Pagination Support

| Endpoint | Default Limit | Notes |
|----------|---------------|-------|
| `GET /api/v1/opportunities` | 100 | Matches existing behavior |
| `GET /api/v1/accounts` | 100 | Includes nested opportunities |
| `GET /api/v1/comments` | 50 | Lower due to heavy nesting |
| `GET /api/v1/tasks/lists/[listId]/tasks` | 100 | Preserves existing filters |
| `GET /api/v1/content` | 50 | Includes creator relation |
| `GET /api/v1/users` | 100 | Org-scoped user list |

### Response Formats

**Legacy mode (no pagination params):**
```json
{
  "opportunities": [...]
}
```

**Paginated mode (with `?page=1&limit=25`):**
```json
{
  "opportunities": [...],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 156,
    "totalPages": 7,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Usage Examples

```bash
# Legacy mode (no pagination)
GET /api/v1/opportunities

# Paginated mode
GET /api/v1/opportunities?page=1&limit=50
GET /api/v1/accounts?page=2&limit=100
GET /api/v1/comments?entityType=opportunity&entityId=abc&page=1&limit=25
GET /api/v1/tasks/lists/list-id/tasks?status=needsAction&page=1
```

### TypeScript Types

```typescript
import { PaginationMeta } from "@/lib/utils/pagination";

interface PaginatedResponse<T> {
  [key: string]: T[];
  pagination: PaginationMeta;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### Implementation Pattern

```typescript
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  const searchParams = req.nextUrl.searchParams;

  const whereClause = { organizationId: user.organization.id };
  const usePagination = wantsPagination(searchParams);

  if (usePagination) {
    // Paginated mode
    const { page, limit } = paginationQuerySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit') || 100,
    });
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      prisma.model.count({ where: whereClause }),
      prisma.model.findMany({ where: whereClause, skip, take: limit }),
    ]);

    return cachedResponse(
      buildPaginatedResponse(data, page, limit, total, 'dataKey'),
      'frequent'
    );
  } else {
    // Legacy mode
    const data = await prisma.model.findMany({ where: whereClause });
    return cachedResponse(buildLegacyResponse(data, 'dataKey'), 'frequent');
  }
}
```

---

## 🔍 Filtering

Support common filters via query parameters:

```typescript
const where: Prisma.OpportunityWhereInput = {
  organizationId: user.organizationId,
};

if (searchParams.get('ownerId')) {
  where.ownerId = searchParams.get('ownerId')!;
}

if (searchParams.get('stage')) {
  where.stage = searchParams.get('stage') as OpportunityStage;
}

if (searchParams.get('columnId')) {
  where.columnId = searchParams.get('columnId')!;
}

const opportunities = await prisma.opportunity.findMany({ where });
```

---

## ⚠️ Error Handling

All API routes must wrap logic in `try/catch`:

```typescript
export async function GET(req: NextRequest) {
  try {
    // ... route logic
  } catch (error) {
    console.error('Error in GET /api/v1/opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 💬 AI Chat Endpoints

### `POST /api/v1/opportunities/[id]/chat`
**Purpose**: Stream AI chat responses about a specific opportunity

**Request**:
```json
{
  "message": "What are the main risks for this deal?",
  "history": [
    {
      "role": "user",
      "content": "Tell me about this opportunity"
    },
    {
      "role": "assistant",
      "content": "This is a $50K ARR opportunity..."
    }
  ]
}
```

**Validation**:
- `message`: Required, string, trimmed, 1-2000 characters
- `history`: Optional, array of messages, max 10 messages

**Response**: Streaming text response
```
Content-Type: text/plain; charset=utf-8
Transfer-Encoding: chunked
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1700000000000
```

**Rate Limiting**: 10 requests per minute per user

**Status Codes**:
- `200`: Success (streaming response)
- `400`: Invalid request (message too long, invalid format)
- `401`: Unauthorized (no auth token)
- `404`: Opportunity not found or no access
- `429`: Rate limit exceeded
- `500`: Internal server error

**Error Response** (for 429):
```json
{
  "error": "Rate limit exceeded. Please try again in 45 seconds.",
  "retryAfter": 45
}
```

---

### `POST /api/v1/accounts/[id]/chat`
**Purpose**: Stream AI chat responses about a specific account

**Request**: Same format as opportunity chat
**Response**: Same format as opportunity chat
**Rate Limiting**: 10 requests per minute per user
**Status Codes**: Same as opportunity chat

**Context Included**:
- Account metadata (industry, health, ticker)
- All opportunities for the account
- Key contacts across opportunities
- SEC filings (AI summaries)
- Earnings transcripts (AI summaries)

---

## 🔒 Security Best Practices

1. **Always validate input** with Zod schemas
2. **Always scope queries** by `organizationId`
3. **Check user permissions** for admin/manager routes
4. **Never expose cross-org data** - always verify ownership
5. **Sanitize user input** - Zod handles this automatically
6. **Use HTTP status codes correctly** - 200, 201, 400, 401, 403, 404, 500
7. **Log errors** but don't expose internal details to clients
8. **Rate limit sensitive endpoints** - Chat endpoints enforce 10 req/min per user
