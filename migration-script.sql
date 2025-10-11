-- Migration: Add Account model and update Opportunity
-- Step 1: Create Account table
CREATE TABLE IF NOT EXISTS opportunity_tracker."Account" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT UNIQUE NOT NULL,
    industry TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    health TEXT NOT NULL DEFAULT 'good',
    notes TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Rename old account column to accountName
ALTER TABLE opportunity_tracker."Opportunity"
  RENAME COLUMN account TO "accountName";

-- Step 3: Add new columns to Opportunity
ALTER TABLE opportunity_tracker."Opportunity"
  ADD COLUMN IF NOT EXISTS "accountId" TEXT,
  ADD COLUMN IF NOT EXISTS quarter TEXT;

-- Step 4: Create foreign key constraint
ALTER TABLE opportunity_tracker."Opportunity"
  ADD CONSTRAINT "Opportunity_accountId_fkey"
  FOREIGN KEY ("accountId")
  REFERENCES opportunity_tracker."Account"(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Migrate existing data - create accounts from accountName and link them
INSERT INTO opportunity_tracker."Account" (id, name, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  "accountName",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM opportunity_tracker."Opportunity"
WHERE "accountName" IS NOT NULL
GROUP BY "accountName"
ON CONFLICT (name) DO NOTHING;

-- Step 6: Update opportunities to link to accounts
UPDATE opportunity_tracker."Opportunity" o
SET "accountId" = a.id
FROM opportunity_tracker."Account" a
WHERE o."accountName" = a.name
  AND o."accountId" IS NULL;
