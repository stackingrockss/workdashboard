-- AlterTable: Add confidenceLevel column and migrate data from probability
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN "confidenceLevel" INTEGER;

-- Copy data from probability to confidenceLevel (convert percentage to 1-5 scale)
-- probability 0-20% -> 1, 21-40% -> 2, 41-60% -> 3, 61-80% -> 4, 81-100% -> 5
UPDATE "opportunity_tracker"."Opportunity"
SET "confidenceLevel" = CASE
  WHEN "probability" <= 20 THEN 1
  WHEN "probability" <= 40 THEN 2
  WHEN "probability" <= 60 THEN 3
  WHEN "probability" <= 80 THEN 4
  ELSE 5
END
WHERE "probability" IS NOT NULL;

-- Set default value for rows where probability was null
UPDATE "opportunity_tracker"."Opportunity"
SET "confidenceLevel" = 3
WHERE "confidenceLevel" IS NULL;

-- Make confidenceLevel NOT NULL with default
ALTER TABLE "opportunity_tracker"."Opportunity" ALTER COLUMN "confidenceLevel" SET NOT NULL;
ALTER TABLE "opportunity_tracker"."Opportunity" ALTER COLUMN "confidenceLevel" SET DEFAULT 3;

-- Drop the old probability column
ALTER TABLE "opportunity_tracker"."Opportunity" DROP COLUMN "probability";
