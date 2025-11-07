# Production Database Migration Guide

## Issue
The production database is missing the `noteType` column on `GranolaNote` and `GongCall` tables, causing this error:
```
Error [PrismaClientKnownRequestError]: Invalid `prisma.opportunity.findUnique()` invocation:
The column `GranolaNote.noteType` does not exist in the current database
```

## Pending Migrations

The following migrations need to be applied to production:

### 1. ✅ 20251106211211_add_confidence_level_field
- Adds `confidenceLevel` field to Opportunity table
- Status: **Needs to be applied**

### 2. ✅ 20251106211801_add_csv_fields
- Adds CSV import fields: `decisionMakers`, `competition`, `legalReviewStatus`, `securityReviewStatus`, `platformType`, `businessCaseStatus`
- Status: **Needs to be applied**

### 3. ✅ 20251106212000_add_note_type_field (NEW)
- Adds `noteType` enum and column to `GranolaNote` and `GongCall` tables
- Status: **Needs to be applied**

---

## How to Apply Migrations

### Option A: Using Prisma Migrate (Recommended)

1. **Set your production DATABASE_URL**:
   ```bash
   export DATABASE_URL="your-production-database-url"
   ```

2. **Apply all pending migrations**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Regenerate Prisma Client**:
   ```bash
   npx prisma generate
   ```

### Option B: Manual SQL Execution

If you prefer to run SQL directly, execute these migrations in order:

#### Migration 1: Add confidence level field
```sql
-- File: prisma/migrations/20251106211211_add_confidence_level_field/migration.sql
ALTER TABLE "opportunity_tracker"."Opportunity"
ADD COLUMN IF NOT EXISTS "confidenceLevel" INTEGER DEFAULT 3;
```

#### Migration 2: Add CSV fields
```sql
-- File: prisma/migrations/20251106211801_add_csv_fields/migration.sql

-- Create enums
DO $$ BEGIN
  CREATE TYPE "opportunity_tracker"."ReviewStatus" AS ENUM ('not_started', 'in_progress', 'complete', 'not_applicable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "opportunity_tracker"."PlatformType" AS ENUM ('oem', 'api', 'isv');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add columns
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "decisionMakers" TEXT;
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "competition" TEXT;
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "legalReviewStatus" "opportunity_tracker"."ReviewStatus" DEFAULT 'not_started';
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "securityReviewStatus" "opportunity_tracker"."ReviewStatus" DEFAULT 'not_started';
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "platformType" "opportunity_tracker"."PlatformType";
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "businessCaseStatus" "opportunity_tracker"."ReviewStatus" DEFAULT 'not_started';
```

#### Migration 3: Add noteType field (FIXES THE ERROR)
```sql
-- File: prisma/migrations/20251106212000_add_note_type_field/migration.sql

-- Create enum
DO $$ BEGIN
  CREATE TYPE "opportunity_tracker"."NoteType" AS ENUM ('customer', 'internal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add columns
ALTER TABLE "opportunity_tracker"."GranolaNote"
ADD COLUMN IF NOT EXISTS "noteType" "opportunity_tracker"."NoteType" DEFAULT 'customer';

ALTER TABLE "opportunity_tracker"."GongCall"
ADD COLUMN IF NOT EXISTS "noteType" "opportunity_tracker"."NoteType" DEFAULT 'customer';
```

---

## Verification

After applying migrations, verify the schema is in sync:

```bash
npx prisma migrate status
```

You should see: **"No pending migrations to apply"**

---

## Rollback (if needed)

If something goes wrong, you can rollback using:

```sql
-- Remove noteType columns
ALTER TABLE "opportunity_tracker"."GranolaNote" DROP COLUMN IF EXISTS "noteType";
ALTER TABLE "opportunity_tracker"."GongCall" DROP COLUMN IF EXISTS "noteType";
DROP TYPE IF EXISTS "opportunity_tracker"."NoteType";

-- Remove CSV fields
ALTER TABLE "opportunity_tracker"."Opportunity" DROP COLUMN IF EXISTS "decisionMakers";
ALTER TABLE "opportunity_tracker"."Opportunity" DROP COLUMN IF EXISTS "competition";
ALTER TABLE "opportunity_tracker"."Opportunity" DROP COLUMN IF EXISTS "legalReviewStatus";
ALTER TABLE "opportunity_tracker"."Opportunity" DROP COLUMN IF EXISTS "securityReviewStatus";
ALTER TABLE "opportunity_tracker"."Opportunity" DROP COLUMN IF EXISTS "platformType";
ALTER TABLE "opportunity_tracker"."Opportunity" DROP COLUMN IF EXISTS "businessCaseStatus";
DROP TYPE IF EXISTS "opportunity_tracker"."ReviewStatus";
DROP TYPE IF EXISTS "opportunity_tracker"."PlatformType";

-- Remove confidence level
ALTER TABLE "opportunity_tracker"."Opportunity" DROP COLUMN IF EXISTS "confidenceLevel";
```

---

## Checklist

- [ ] Backup production database
- [ ] Apply migration 1 (confidence level)
- [ ] Apply migration 2 (CSV fields)
- [ ] Apply migration 3 (noteType) - **This fixes the error**
- [ ] Run `npx prisma generate` to update Prisma Client
- [ ] Restart your application
- [ ] Verify no errors in logs
- [ ] Test creating/viewing opportunities with notes

---

## Support

If you encounter issues:
1. Check migration status: `npx prisma migrate status`
2. Validate schema: `npx prisma validate`
3. Review database schema: `npx prisma studio`
