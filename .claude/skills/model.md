# Skill: /model

> Add Prisma models with full type support and multi-tenancy

## Purpose

Generate complete data model infrastructure including:
- Prisma schema model
- TypeScript type definitions
- Zod validation schemas
- Enum label/color mappings

## Questions to Ask

1. **Model name** - PascalCase (e.g., "Note", "Activity", "Task")
2. **Fields** - For each field:
   - Name (camelCase)
   - Type (String, Int, Float, Boolean, DateTime, Json, enum)
   - Optional? (default: required)
   - Default value?
   - Constraints (unique, @db.Text for large text)
3. **Relations** - What does it belong to?
   - Organization (always required)
   - User (owner tracking?)
   - Other models (Opportunity, Account, etc.)
4. **Indexes** - What fields need indexing for queries?
5. **Unique constraints** - Any unique field combinations?

## Output Files

```
prisma/schema.prisma        (update - add model)
src/types/{model}.ts        (create)
src/lib/validations/{model}.ts  (create)
```

## Prisma Schema Template

```prisma
// =============================================================================
// {Model} - {Description}
// =============================================================================

model {Model} {
  // Primary key - always CUID
  id String @id @default(cuid())

  // ==========================================================================
  // Multi-tenancy (REQUIRED on every model)
  // ==========================================================================
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // ==========================================================================
  // Core Fields
  // ==========================================================================
  name        String
  description String?  @db.Text
  status      {Model}Status @default(active)

  // ==========================================================================
  // Optional Owner Tracking
  // ==========================================================================
  ownerId String?
  owner   User?   @relation(fields: [ownerId], references: [id])

  // ==========================================================================
  // Relations to Other Models
  // ==========================================================================
  opportunityId String?
  opportunity   Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  accountId String?
  account   Account? @relation(fields: [accountId], references: [id])

  // ==========================================================================
  // Timestamps (REQUIRED on every model)
  // ==========================================================================
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // ==========================================================================
  // Indexes
  // ==========================================================================
  @@index([organizationId])
  @@index([ownerId])
  @@index([opportunityId])
  @@index([status])
  @@index([createdAt])

  // Optional: Composite unique constraint
  // @@unique([organizationId, name])

  @@schema("opportunity_tracker")
}

// Enum for status (if needed)
enum {Model}Status {
  active
  archived
  deleted

  @@schema("opportunity_tracker")
}
```

## TypeScript Types Template

```typescript
// src/types/{model}.ts
// Type definitions for {Model}

// =============================================================================
// Enums (mirror Prisma enums)
// =============================================================================

export type {Model}Status = "active" | "archived" | "deleted";

// =============================================================================
// Label Mappings
// =============================================================================

export const {MODEL}_STATUS_LABELS: Record<{Model}Status, string> = {
  active: "Active",
  archived: "Archived",
  deleted: "Deleted",
};

// Optional: Color mappings for badges
export const {MODEL}_STATUS_COLORS: Record<{Model}Status, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  deleted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// Options for select dropdowns
export const {MODEL}_STATUS_OPTIONS = Object.entries({MODEL}_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as {Model}Status, label })
);

// =============================================================================
// Main Interface
// =============================================================================

export interface {Model} {
  id: string;
  organizationId: string;

  // Core fields
  name: string;
  description?: string | null;
  status: {Model}Status;

  // Owner (if tracked)
  ownerId?: string | null;
  owner?: {Model}Owner | null;

  // Relations
  opportunityId?: string | null;
  opportunity?: {
    id: string;
    name: string;
  } | null;

  accountId?: string | null;
  account?: {
    id: string;
    name: string;
  } | null;

  // Timestamps (always ISO strings in TypeScript)
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Partial Types for Relations
// =============================================================================

export interface {Model}Owner {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

export function get{Model}StatusLabel(status: {Model}Status): string {
  return {MODEL}_STATUS_LABELS[status];
}

export function get{Model}StatusColor(status: {Model}Status): string {
  return {MODEL}_STATUS_COLORS[status];
}

// =============================================================================
// Backwards Compatibility (if renaming)
// =============================================================================

// /** @deprecated Use {Model} instead */
// export type OldModelName = {Model};
```

## Common Field Patterns

### Required Fields (Every Model)

```prisma
id             String   @id @default(cuid())
organizationId String
organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
createdAt      DateTime @default(now())
updatedAt      DateTime @updatedAt

@@index([organizationId])
@@schema("opportunity_tracker")
```

### Owner Tracking

```prisma
ownerId String?
owner   User?   @relation(fields: [ownerId], references: [id])

@@index([ownerId])
```

### Large Text Content

```prisma
content     String? @db.Text
notes       String? @db.Text
description String? @db.Text
```

### JSON Fields

```prisma
metadata        Json?   // Flexible object storage
sections        Json    // Array<{ title: string, description?: string }>
contextSnapshot Json?   // Stores configuration at point in time
```

### Status/Processing Fields

```prisma
// Generation status pattern
generationStatus {Model}GenerationStatus? @default(pending)
generatedAt      DateTime?
generationError  String?

// Versioning pattern
version         Int     @default(1)
parentVersionId String?
parentVersion   {Model}? @relation("VersionHistory", fields: [parentVersionId], references: [id])
childVersions   {Model}[] @relation("VersionHistory")
```

### Soft Delete

```prisma
deletedAt DateTime?

@@index([deletedAt])
```

### Relation Patterns

```prisma
// One-to-Many (parent side)
children {Child}[]

// One-to-Many (child side)
parentId String
parent   {Parent} @relation(fields: [parentId], references: [id], onDelete: Cascade)

// Optional relation
accountId String?
account   Account? @relation(fields: [accountId], references: [id])

// Self-relation (hierarchy)
parentId String?
parent   {Model}?  @relation("Hierarchy", fields: [parentId], references: [id])
children {Model}[] @relation("Hierarchy")
```

## Index Patterns

```prisma
// Single field indexes (for filtering)
@@index([organizationId])
@@index([ownerId])
@@index([status])
@@index([createdAt])

// Composite indexes (for compound queries)
@@index([organizationId, createdAt])
@@index([organizationId, status])
@@index([opportunityId, createdAt])

// Unique constraints
@@unique([organizationId, name])
@@unique([organizationId, email])
@@unique([userId, externalId])
```

## After Creating Model

Run these commands:

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add-{model}-model
```

## Chaining

After creating a model, consider:

- **`/validation`** - Create Zod schemas (if not generated)
- **`/api`** - Create API routes for CRUD operations
- **`/component`** - Create UI components for the model

## Existing Models for Reference

| Model | Location | Features |
|-------|----------|----------|
| `Opportunity` | schema.prisma | Full relations, enums, indexes |
| `Account` | schema.prisma | Domain normalization, nested contacts |
| `Contact` | schema.prisma | Enum with colors, role tracking |
| `Document` | schema.prisma | Versioning, generation status, JSON sections |
| `ContentBrief` | schema.prisma | Templates, usage counting, categories |
| `Comment` | schema.prisma | Polymorphic (entityType/entityId), mentions |
| `GongCall` | schema.prisma | External integration, parsing status |

## Checklist

- [ ] Model has `organizationId` with index
- [ ] Model has `createdAt` and `updatedAt`
- [ ] Model uses CUID for ID
- [ ] Relations have appropriate `onDelete` behavior
- [ ] Indexes exist for commonly queried fields
- [ ] TypeScript types mirror Prisma model
- [ ] Enum labels and colors are defined
- [ ] Zod schemas handle create/update
- [ ] Migration has been created and applied
