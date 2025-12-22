# Skill: /validation

> Create Zod validation schemas following project patterns

## Purpose

Generate Zod validation schemas for create/update operations with proper transforms, refinements, and TypeScript type inference.

## Questions to Ask

1. **Schema name** - What entity is this for? (e.g., "note", "task", "activity")
2. **Fields** - What fields does it need?
   - Field name
   - Type (string, number, boolean, enum, date, array, object)
   - Required or optional?
   - Constraints (min, max, regex, etc.)
3. **Transforms** - Any data normalization needed?
   - URL normalization
   - Case conversion (uppercase, lowercase)
   - Trim whitespace
   - Empty string to null
4. **Refinements** - Any cross-field validation?
   - At least one of X or Y required
   - End date after start date
   - Custom business rules

## Output Files

```
src/lib/validations/{schema}.ts
```

## Template

```typescript
// src/lib/validations/{schema}.ts
// Validation schemas for {Entity} create and update operations

import { z } from "zod";

// =============================================================================
// Base Schema
// =============================================================================

const base{Entity}Schema = z.object({
  // Required string field
  name: z.string().min(1, "Name is required").max(200),

  // Optional string field
  description: z.string().max(1000).optional().nullable(),

  // Number with constraints
  amount: z.number().int().nonnegative().optional().default(0),

  // Enum field
  status: z.enum(["pending", "active", "completed"]).optional().default("pending"),

  // Date as ISO string
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
    .optional()
    .nullable(),

  // Boolean with default
  isActive: z.boolean().optional().default(true),

  // Array of strings
  tags: z.array(z.string().max(50)).max(10).optional().default([]),

  // Nested object
  metadata: z.object({
    source: z.string().optional(),
    version: z.number().int().positive().optional(),
  }).optional(),
});

// =============================================================================
// Transform Patterns
// =============================================================================

// URL normalization
const urlField = z
  .string()
  .min(1, "URL is required")
  .transform((val) => {
    let url = val.trim().toLowerCase();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    return url;
  })
  .refine(
    (val) => {
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid URL format" }
  );

// Domain extraction
const domainField = z
  .string()
  .max(255)
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return null;
    let domain = val.toLowerCase().trim();
    domain = domain.replace(/^https?:\/\//, "");
    domain = domain.replace(/^www\./, "");
    domain = domain.split("/")[0];
    return domain || null;
  });

// Uppercase transform (e.g., ticker symbols)
const tickerField = z
  .string()
  .max(10)
  .optional()
  .transform((val) => val?.trim().toUpperCase() || undefined);

// Empty string to null
const nullableTextField = z
  .string()
  .max(10000)
  .optional()
  .nullable()
  .transform((val) => (val === "" ? null : val));

// =============================================================================
// Create Schema
// =============================================================================

export const {entity}CreateSchema = base{Entity}Schema
  .extend({
    // Add required fields for creation
    name: z.string().min(1, "Name is required").max(200),

    // Make some fields required on create
    // accountId: z.string().cuid(),
  })
  .refine(
    (data) => {
      // Cross-field validation example
      // return data.fieldA || data.fieldB;
      return true;
    },
    {
      message: "At least one of fieldA or fieldB is required",
      path: ["fieldA"],
    }
  );

// =============================================================================
// Update Schema
// =============================================================================

export const {entity}UpdateSchema = base{Entity}Schema
  .extend({
    // Override fields that need different validation on update
    name: z.string().min(1).max(200).optional(),
  })
  .partial(); // Makes all fields optional for PATCH

// =============================================================================
// Type Exports
// =============================================================================

export type {Entity}CreateInput = z.infer<typeof {entity}CreateSchema>;
export type {Entity}UpdateInput = z.infer<typeof {entity}UpdateSchema>;

// =============================================================================
// Query Schemas (Optional - for list filtering)
// =============================================================================

export const {entity}QuerySchema = z.object({
  status: z.enum(["pending", "active", "completed"]).optional(),
  search: z.string().max(100).optional(),
  ownerId: z.string().cuid().optional(),
});

export type {Entity}QueryInput = z.infer<typeof {entity}QuerySchema>;
```

## Common Field Patterns

### String Fields

```typescript
// Required with length constraints
name: z.string().min(1, "Required").max(200)

// Optional, nullable
notes: z.string().max(10000).optional().nullable()

// With regex
phone: z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone format").optional()

// Email
email: z.string().email("Invalid email").max(255)
```

### Number Fields

```typescript
// Integer with range
quantity: z.number().int().min(1).max(1000)

// Non-negative with default
amount: z.number().nonnegative().optional().default(0)

// Confidence level (1-5)
confidenceLevel: z.number().int().min(1).max(5).optional().default(3)

// Currency (stored as cents)
amountCents: z.number().int().nonnegative()
```

### Enum Fields

```typescript
// Simple enum
status: z.enum(["draft", "published", "archived"])

// With default
priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium")

// Nullable enum
stage: z.enum(["discovery", "demo", "contracting"]).nullable()
```

### Date Fields

```typescript
// ISO date string (YYYY-MM-DD)
closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")

// ISO datetime string
scheduledAt: z.string().datetime({ message: "Invalid datetime" })

// Optional date with null
expiresAt: z.string().datetime().optional().nullable()
```

### Relation Fields

```typescript
// Required relation
accountId: z.string().cuid("Invalid account ID")

// Optional relation
opportunityId: z.string().cuid().optional().nullable()

// Find or create pattern
accountName: z.string().min(1).max(200).optional()  // Used if accountId not provided
```

### Array Fields

```typescript
// Array of strings
tags: z.array(z.string().max(50)).max(20).optional().default([])

// Array of objects
sections: z.array(
  z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    required: z.boolean().default(false),
  })
).min(1).max(20)

// Array of IDs
contactIds: z.array(z.string().cuid()).optional().default([])
```

### JSON/Object Fields

```typescript
// Flexible object
metadata: z.record(z.unknown()).optional()

// Typed object
contextSnapshot: z.object({
  gongCallIds: z.array(z.string()).optional(),
  granolaNoteIds: z.array(z.string()).optional(),
  additionalContext: z.string().optional(),
}).optional()
```

## Refinement Examples

```typescript
// At least one field required
.refine(
  (data) => data.accountId || data.accountName,
  {
    message: "Either accountId or accountName must be provided",
    path: ["accountId"],
  }
)

// Date range validation
.refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
)

// Conditional required field
.refine(
  (data) => {
    if (data.status === "completed") {
      return !!data.completedAt;
    }
    return true;
  },
  {
    message: "Completed date is required when status is completed",
    path: ["completedAt"],
  }
)
```

## Chaining

After creating validation schemas, consider:

- **`/model`** - If you need a corresponding Prisma model
- **`/api`** - To create API routes that use these schemas

## Location

All validation schemas go in: `src/lib/validations/`

Existing schemas for reference:
- `opportunity.ts` - Complex with transforms and refinements
- `account.ts` - URL normalization, domain extraction
- `contact.ts` - Email validation, phone formatting
- `document.ts` - Nested object validation
- `brief.ts` - Array validation, sections