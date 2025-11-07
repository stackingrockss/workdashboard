# Critical Errors to Fix

## TypeScript Compilation Errors Summary

**Total Errors Found: ~40+**

### Category 1: Prisma Schema Relation Name Changes (Most Common)

The Prisma schema introspection capitalized relation names. Need to update all references:

#### Files Affected:
- `src/app/api/v1/accounts/[id]/convert/route.ts`
- `src/app/api/v1/accounts/[id]/route.ts`
- `src/app/api/v1/accounts/route.ts`
- `src/app/api/v1/opportunities/[id]/contacts/*/route.ts`

#### Issue:
```typescript
// ❌ OLD (lowercase)
include: {
  opportunities: true,
  contacts: true,
  account: true,
  manager: true,
}

// ✅ NEW (PascalCase - from Prisma introspection)
include: {
  Opportunity: true,
  Contact: true,
  Account: true,
  Contact_Contact_managerIdToContact: true, // Manager relation
}
```

### Category 2: KanbanColumn userId Field Removed

All references to `KanbanColumn.userId` need to be updated to use the new KanbanView system.

#### Files Affected:
- `src/app/api/v1/columns/route.ts` (multiple locations)
- `src/app/api/v1/columns/[id]/route.ts` (multiple locations)

#### Fix Pattern:
```typescript
// ❌ OLD
where: {
  userId: user.id,
}

// ✅ NEW
where: {
  view: {
    userId: user.id,
    isActive: true,
  },
}
```

### Category 3: Missing Required Fields in Create Operations

Many create operations are missing required fields added by migration:
- `id` (should use @default(cuid()) but Prisma introspection may have removed it)
- `updatedAt` (should use @updatedAt)
- `organizationId` (newly required)

#### Files Affected:
- `scripts/migrate-accounts.ts`
- `src/app/api/v1/accounts/*/route.ts`
- `src/app/api/v1/opportunities/*/route.ts`

#### Fix:
Either the Prisma schema needs `@default(cuid())` and `@updatedAt` decorators restored, or these fields need to be explicitly provided.

### Category 4: Contact Manager Relation Name Change

The Contact model's self-referential manager relation was renamed during introspection.

#### Files Affected:
- All contact-related API routes

#### Fix:
```typescript
// ❌ OLD
include: {
  manager: true,
}

// ✅ NEW (check actual schema)
include: {
  Contact_Contact_managerIdToContact: true,
}
```

---

## Recommended Fix Order

### 1. **CRITICAL: Fix Prisma Schema (Highest Priority)**

The schema was introspected and lost important decorators. Need to manually update:

**File: `prisma/schema.prisma`**

Add back:
- `@default(cuid())` to all `id` fields
- `@updatedAt` to all `updatedAt` fields
- Rename relations to be more readable (optional but helpful)

```prisma
model Account {
  id          String   @id @default(cuid())  // ✅ Add @default
  updatedAt   DateTime @updatedAt            // ✅ Add @updatedAt
  // ... rest of fields

  // ✅ Better relation names
  opportunities Opportunity[] @relation("AccountOpportunities")
  contacts      Contact[]     @relation("AccountContacts")
}
```

After fixing, run:
```bash
npx prisma generate
```

### 2. **HIGH: Update All API Routes**

**Pattern to follow:**

```typescript
// Always include organizationId in creates
const account = await prisma.account.create({
  data: {
    name: data.name,
    organizationId: user.organization.id,  // ✅ Required
    ownerId: user.id,
    // ... other fields
  },
});

// Use correct relation names from schema
include: {
  Opportunity: true,  // Check your actual schema
  Contact: true,
}
```

### 3. **MEDIUM: Fix KanbanColumn References**

Search for all `userId` references in column routes and update to use view-based queries.

**Files to update:**
- `src/app/api/v1/columns/route.ts`
- `src/app/api/v1/columns/[id]/route.ts`

### 4. **LOW: Fix Scripts**

Update migration scripts to match new schema.

---

## Quick Fix Script

Create a script to find and list all instances:

```bash
# Find all userId references in columns
grep -r "userId" src/app/api/v1/columns/

# Find all lowercase relation includes
grep -r "include: {" src/app/api/v1/ | grep -E "(opportunities|contacts|account|manager):"

# Find all creates missing organizationId
grep -r "\.create({" src/app/api/v1/ -A 5
```

---

## After Fixing

1. Run `npx prisma generate`
2. Run `npx tsc --noEmit` to verify no errors
3. Test each API endpoint manually
4. Run the app and check for runtime errors

---

## Estimated Time to Fix

- **Prisma Schema Fix**: 30 minutes
- **API Routes Update**: 2-3 hours
- **Testing**: 1-2 hours

**Total**: ~4-6 hours

---

## Notes

The introspection changed many things automatically. The safest approach is:

1. Manually craft the "ideal" Prisma schema with proper decorators and relation names
2. Create a new migration to apply those changes
3. Update all code to use the new schema
4. Test thoroughly

OR

1. Accept the introspected schema as-is
2. Update all code to match it
3. Test thoroughly

**Recommendation**: Go with approach #2 (accept introspected schema) as it's faster and less risky.

