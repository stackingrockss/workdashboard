-- Migration script to update ForecastCategory enum
-- This adds the new enum values, migrates data, then removes the old value

BEGIN;

-- Step 1: Add new enum values to ForecastCategory
ALTER TYPE "opportunity_tracker"."ForecastCategory" ADD VALUE IF NOT EXISTS 'commit';
ALTER TYPE "opportunity_tracker"."ForecastCategory" ADD VALUE IF NOT EXISTS 'closedWon';
ALTER TYPE "opportunity_tracker"."ForecastCategory" ADD VALUE IF NOT EXISTS 'closedLost';

-- Step 2: Migrate existing "forecast" values to "commit"
UPDATE "opportunity_tracker"."Opportunity"
SET "forecastCategory" = 'commit'
WHERE "forecastCategory" = 'forecast';

-- Step 3: Set forecast category for opportunities based on stage
-- (for opportunities that don't have a forecastCategory set)
UPDATE "opportunity_tracker"."Opportunity"
SET "forecastCategory" = 'closedWon'
WHERE stage = 'closedWon' AND "forecastCategory" IS NULL;

UPDATE "opportunity_tracker"."Opportunity"
SET "forecastCategory" = 'closedLost'
WHERE stage = 'closedLost' AND "forecastCategory" IS NULL;

UPDATE "opportunity_tracker"."Opportunity"
SET "forecastCategory" = 'commit'
WHERE stage IN ('decisionMakerApproval', 'contracting') AND "forecastCategory" IS NULL;

UPDATE "opportunity_tracker"."Opportunity"
SET "forecastCategory" = 'bestCase'
WHERE stage = 'validateSolution' AND "forecastCategory" IS NULL;

UPDATE "opportunity_tracker"."Opportunity"
SET "forecastCategory" = 'pipeline'
WHERE stage IN ('discovery', 'demo') AND "forecastCategory" IS NULL;

COMMIT;

-- Note: Removing old enum values requires recreating the enum type
-- This is done separately with Prisma db push --accept-data-loss after data migration
