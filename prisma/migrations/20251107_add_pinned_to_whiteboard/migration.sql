-- Add pinnedToWhiteboard column to Opportunity table
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN "pinnedToWhiteboard" BOOLEAN NOT NULL DEFAULT false;
