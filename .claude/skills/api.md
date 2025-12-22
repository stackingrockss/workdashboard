# Skill: /api

> Scaffold API route handlers with auth, validation, and org-scoping

## Purpose

Generate REST API endpoints following project patterns:
- Authentication via `requireAuth()`
- Organization scoping for multi-tenancy
- Zod validation with proper error responses
- Pagination support
- Caching headers
- Consistent response formats

## Questions to Ask

1. **Resource name** - What entity? (e.g., "notes", "tasks", "activities")
2. **HTTP methods** - Which operations?
   - GET (list) - Paginated list of resources
   - GET (detail) - Single resource by ID
   - POST - Create new resource
   - PATCH - Update existing resource
   - DELETE - Remove resource
3. **Nested route?** - Is this under a parent resource?
   - Example: `/api/v1/opportunities/[id]/notes`
4. **Parent resource** - If nested, what's the parent? (e.g., "opportunities")
5. **Relations to include** - What related data to include? (owner, account, etc.)

## Output Files

```
# Standard route
src/app/api/v1/{resources}/route.ts          (GET list, POST)
src/app/api/v1/{resources}/[id]/route.ts     (GET detail, PATCH, DELETE)

# Nested route
src/app/api/v1/{parent}/[id]/{resources}/route.ts
src/app/api/v1/{parent}/[parentId]/{resources}/[id]/route.ts
```

## Standard Route Template

### List + Create (`/api/v1/{resources}/route.ts`)

```typescript
// src/app/api/v1/{resources}/route.ts
// API routes for {Resource} list and create operations

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { {resource}CreateSchema } from "@/lib/validations/{resource}";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

// =============================================================================
// GET - List {Resources}
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = req.nextUrl.searchParams;

    // Build where clause - ALWAYS scope to organization
    const whereClause = {
      organizationId: user.organization.id,
    };

    // Optional: Add filters from query params
    const status = searchParams.get("status");
    if (status) {
      Object.assign(whereClause, { status });
    }

    const search = searchParams.get("search");
    if (search) {
      Object.assign(whereClause, {
        name: { contains: search, mode: "insensitive" },
      });
    }

    // Check if pagination is requested
    const usePagination = wantsPagination(searchParams);

    if (usePagination) {
      // Paginated mode
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get("page"),
        limit: searchParams.get("limit") || 100,
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 100;
      const skip = (page - 1) * limit;

      const [total, {resources}] = await Promise.all([
        prisma.{resource}.count({ where: whereClause }),
        prisma.{resource}.findMany({
          where: whereClause,
          include: {
            owner: true,
            // Add other relations as needed
          },
          orderBy: { updatedAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      return cachedResponse(
        buildPaginatedResponse({resources}, page, limit, total, "{resources}"),
        "frequent"
      );
    } else {
      // Legacy mode (backwards compatible)
      const {resources} = await prisma.{resource}.findMany({
        where: whereClause,
        include: {
          owner: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });

      return cachedResponse(
        buildLegacyResponse({resources}, "{resources}"),
        "frequent"
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching {resources}:", error);
    return NextResponse.json(
      { error: "Failed to fetch {resources}" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create {Resource}
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    // Validate input
    const parsed = {resource}CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Create resource - ALWAYS set organizationId
    const {resource} = await prisma.{resource}.create({
      data: {
        ...data,
        organizationId: user.organization.id,
        ownerId: data.ownerId ?? user.id,
      },
      include: {
        owner: true,
      },
    });

    return NextResponse.json({ {resource} }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating {resource}:", error);
    return NextResponse.json(
      { error: "Failed to create {resource}" },
      { status: 500 }
    );
  }
}
```

### Detail + Update + Delete (`/api/v1/{resources}/[id]/route.ts`)

```typescript
// src/app/api/v1/{resources}/[id]/route.ts
// API routes for {Resource} detail, update, and delete operations

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { {resource}UpdateSchema } from "@/lib/validations/{resource}";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// =============================================================================
// GET - Get Single {Resource}
// =============================================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    // SECURITY: Always scope to organization
    const {resource} = await prisma.{resource}.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
      include: {
        owner: true,
        // Add other relations as needed
      },
    });

    if (!{resource}) {
      return NextResponse.json(
        { error: "{Resource} not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ {resource} });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(`[GET /api/v1/{resources}/${id}] Error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch {resource}" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update {Resource}
// =============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();
    const body = await req.json();

    // Validate input
    const parsed = {resource}UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // SECURITY: Verify ownership before updating
    const existing = await prisma.{resource}.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "{Resource} not found" },
        { status: 404 }
      );
    }

    // Build update data - only include explicitly provided fields
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    // Add other fields as needed

    const {resource} = await prisma.{resource}.update({
      where: { id },
      data: updateData,
      include: {
        owner: true,
      },
    });

    return NextResponse.json({ {resource} });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(`[PATCH /api/v1/{resources}/${id}] Error:`, error);
    return NextResponse.json(
      { error: "Failed to update {resource}" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete {Resource}
// =============================================================================

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    // SECURITY: Verify ownership before deleting
    const existing = await prisma.{resource}.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "{Resource} not found" },
        { status: 404 }
      );
    }

    // Optional: Check for dependent resources
    // const dependentCount = await prisma.child.count({
    //   where: { {resource}Id: id },
    // });
    // if (dependentCount > 0) {
    //   return NextResponse.json(
    //     { error: "Cannot delete {resource} with associated items" },
    //     { status: 400 }
    //   );
    // }

    await prisma.{resource}.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(`[DELETE /api/v1/{resources}/${id}] Error:`, error);
    return NextResponse.json(
      { error: "Failed to delete {resource}" },
      { status: 500 }
    );
  }
}
```

## Nested Route Template

### `/api/v1/{parent}/[parentId]/{resources}/route.ts`

```typescript
// src/app/api/v1/{parent}/[parentId]/{resources}/route.ts
// Nested API routes for {Resources} under {Parent}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { {resource}CreateSchema } from "@/lib/validations/{resource}";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parentId: string }> }
) {
  try {
    const user = await requireAuth();
    const { parentId } = await params;

    // Step 1: Verify parent exists and belongs to org
    const {parent} = await prisma.{parent}.findFirst({
      where: {
        id: parentId,
        organizationId: user.organization.id,
      },
    });

    if (!{parent}) {
      return NextResponse.json(
        { error: "{Parent} not found" },
        { status: 404 }
      );
    }

    // Step 2: Fetch child resources
    const {resources} = await prisma.{resource}.findMany({
      where: { {parent}Id: parentId },
      include: { owner: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ {resources} });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch {resources}" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parentId: string }> }
) {
  try {
    const user = await requireAuth();
    const { parentId } = await params;
    const body = await request.json();

    // Step 1: Verify parent exists and belongs to org
    const {parent} = await prisma.{parent}.findFirst({
      where: {
        id: parentId,
        organizationId: user.organization.id,
      },
    });

    if (!{parent}) {
      return NextResponse.json(
        { error: "{Parent} not found" },
        { status: 404 }
      );
    }

    // Step 2: Validate input
    const parsed = {resource}CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Step 3: Create with parent reference
    const {resource} = await prisma.{resource}.create({
      data: {
        ...parsed.data,
        {parent}Id: parentId,
        organizationId: user.organization.id,
        ownerId: user.id,
      },
      include: { owner: true },
    });

    return NextResponse.json({ {resource} }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create {resource}" },
      { status: 500 }
    );
  }
}
```

## Response Format Standards

### Success Responses

```typescript
// List
{ {resources}: [...], pagination?: { page, limit, total, totalPages } }

// Create (status 201)
{ {resource}: {...} }

// Detail
{ {resource}: {...} }

// Update
{ {resource}: {...} }

// Delete
{ ok: true }
```

### Error Responses

```typescript
// 400 - Validation error
{ error: { formErrors: [], fieldErrors: { field: ["message"] } } }

// 401 - Unauthorized
{ error: "Unauthorized" }

// 404 - Not found
{ error: "{Resource} not found" }

// 409 - Conflict
{ error: "message", details?: {...} }

// 500 - Server error
{ error: "Failed to {action} {resource}" }
```

## Key Imports

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { {resource}CreateSchema, {resource}UpdateSchema } from "@/lib/validations/{resource}";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";
```

## Chaining

Before creating API routes, ensure you have:
- **`/model`** - Prisma model exists
- **`/validation`** - Zod schemas exist

After creating API routes, consider:
- **`/component`** - UI components to consume the API
- **`/test`** - API route tests

## Existing APIs for Reference

| Route | Methods | Features |
|-------|---------|----------|
| `/api/v1/opportunities` | GET, POST | Full pagination, filtering, includes |
| `/api/v1/opportunities/[id]` | GET, PATCH, DELETE | Ownership verification |
| `/api/v1/accounts/[id]/contacts` | GET, POST | Nested route pattern |
| `/api/v1/opportunities/[id]/documents` | GET, POST | Child resources |

## Checklist

- [ ] All queries scope by `organizationId`
- [ ] `requireAuth()` at start of every handler
- [ ] Zod validation with `safeParse()`
- [ ] Ownership verified before update/delete
- [ ] Consistent response format
- [ ] Proper HTTP status codes
- [ ] Error logging with context
- [ ] Pagination support (if list endpoint)
