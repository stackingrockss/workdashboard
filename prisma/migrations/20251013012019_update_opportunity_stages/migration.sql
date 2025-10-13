-- AlterEnum - Safely migrate OpportunityStage enum values
-- Step 1: Create new enum with new values
CREATE TYPE "opportunity_tracker"."OpportunityStage_new" AS ENUM ('discovery', 'demo', 'validateSolution', 'decisionMakerApproval', 'contracting', 'closedWon', 'closedLost');

-- Step 2: Migrate existing data to new stages (best-effort mapping)
-- prospect -> discovery
-- qualification -> demo
-- proposal -> validateSolution
-- negotiation -> decisionMakerApproval
-- closedWon -> closedWon (unchanged)
-- closedLost -> closedLost (unchanged)
ALTER TABLE "opportunity_tracker"."Opportunity"
  ALTER COLUMN "stage" TYPE "opportunity_tracker"."OpportunityStage_new"
  USING (
    CASE "stage"::text
      WHEN 'prospect' THEN 'discovery'
      WHEN 'qualification' THEN 'demo'
      WHEN 'proposal' THEN 'validateSolution'
      WHEN 'negotiation' THEN 'decisionMakerApproval'
      WHEN 'closedWon' THEN 'closedWon'
      WHEN 'closedLost' THEN 'closedLost'
      ELSE 'discovery'
    END::"opportunity_tracker"."OpportunityStage_new"
  );

-- Step 3: Drop old enum and rename new enum
DROP TYPE "opportunity_tracker"."OpportunityStage";
ALTER TYPE "opportunity_tracker"."OpportunityStage_new" RENAME TO "OpportunityStage";
