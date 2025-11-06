-- CreateEnum for ReviewStatus (if not exists)
DO $$ BEGIN
  CREATE TYPE "opportunity_tracker"."ReviewStatus" AS ENUM ('not_started', 'in_progress', 'complete', 'not_applicable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum for PlatformType (if not exists)
DO $$ BEGIN
  CREATE TYPE "opportunity_tracker"."PlatformType" AS ENUM ('oem', 'api', 'isv');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add CSV fields to Opportunity table
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "decisionMakers" TEXT;
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "competition" TEXT;
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "legalReviewStatus" "opportunity_tracker"."ReviewStatus" DEFAULT 'not_started';
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "securityReviewStatus" "opportunity_tracker"."ReviewStatus" DEFAULT 'not_started';
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "platformType" "opportunity_tracker"."PlatformType";
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN IF NOT EXISTS "businessCaseStatus" "opportunity_tracker"."ReviewStatus" DEFAULT 'not_started';
