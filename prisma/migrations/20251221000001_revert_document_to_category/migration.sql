-- Revert Document.documentType back to Document.category with BriefCategory enum
-- This migration reverts the database to match the codebase structure

-- Step 1: Add the missing enum values to FrameworkCategory
ALTER TYPE "opportunity_tracker"."FrameworkCategory" ADD VALUE IF NOT EXISTS 'pricing_proposal';
ALTER TYPE "opportunity_tracker"."FrameworkCategory" ADD VALUE IF NOT EXISTS 'business_impact_proposal';

-- Step 2: Add a temporary category column to Document table
ALTER TABLE "opportunity_tracker"."Document" ADD COLUMN "category" "opportunity_tracker"."FrameworkCategory";

-- Step 3: Migrate data from documentType to category
-- Map DocumentType values to BriefCategory values
UPDATE "opportunity_tracker"."Document"
SET "category" = CASE "documentType"::text
  WHEN 'mutual_action_plan' THEN 'mutual_action_plan'
  WHEN 'rich_text' THEN 'notes'
  WHEN 'framework_generated' THEN 'general'
END::"opportunity_tracker"."FrameworkCategory";

-- Step 4: Make category NOT NULL (if there are no null values from migration)
ALTER TABLE "opportunity_tracker"."Document" ALTER COLUMN "category" SET NOT NULL;

-- Step 5: Drop the old documentType column
ALTER TABLE "opportunity_tracker"."Document" DROP COLUMN "documentType";

-- Step 6: Drop old indexes on documentType
DROP INDEX IF EXISTS "opportunity_tracker"."Document_documentType_idx";
DROP INDEX IF EXISTS "opportunity_tracker"."Document_opportunityId_documentType_idx";

-- Step 7: Create new indexes on category
CREATE INDEX "Document_category_idx" ON "opportunity_tracker"."Document"("category");
CREATE INDEX "Document_opportunityId_category_idx" ON "opportunity_tracker"."Document"("opportunityId", "category");

-- Step 8: Drop the DocumentType enum (if no other tables use it)
DROP TYPE IF EXISTS "opportunity_tracker"."DocumentType";
