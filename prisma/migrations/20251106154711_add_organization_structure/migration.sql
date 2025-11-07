-- AlterTable, CreateTable for the organization structure
-- This migration handles existing data by creating organizations for each user

-- Step 1: Create UserRole enum
CREATE TYPE "opportunity_tracker"."UserRole" AS ENUM ('ADMIN', 'MANAGER', 'REP', 'VIEWER');

-- Step 2: Create Organization table
CREATE TABLE "opportunity_tracker"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "logo" TEXT,
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create OrganizationSettings table
CREATE TABLE "opportunity_tracker"."OrganizationSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultKanbanView" TEXT,
    "defaultKanbanTemplateId" TEXT,
    "allowSelfSignup" BOOLEAN NOT NULL DEFAULT false,
    "allowDomainAutoJoin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- Step 4: Create Invitation table
CREATE TABLE "opportunity_tracker"."Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "opportunity_tracker"."UserRole" NOT NULL DEFAULT 'REP',
    "organizationId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- Step 5: Create ViewType enum for KanbanView
CREATE TYPE "opportunity_tracker"."ViewType" AS ENUM ('custom', 'quarterly', 'stages', 'forecast');

-- Step 6: Create KanbanView table
CREATE TABLE "opportunity_tracker"."KanbanView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "viewType" "opportunity_tracker"."ViewType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "organizationId" TEXT,
    "lastAccessedAt" TIMESTAMP(3),
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanView_pkey" PRIMARY KEY ("id")
);

-- Step 7: Create organizations for each existing user
INSERT INTO "opportunity_tracker"."Organization" (id, name, "fiscalYearStartMonth", "createdAt", "updatedAt")
SELECT
  'org-' || "User".id,
  COALESCE("CompanySettings"."companyName", "User".name || '''s Organization'),
  COALESCE("CompanySettings"."fiscalYearStartMonth", 1),
  NOW(),
  NOW()
FROM "opportunity_tracker"."User"
LEFT JOIN "opportunity_tracker"."CompanySettings" ON "CompanySettings"."userId" = "User".id;

-- Step 8: Add organizationId column to User table (nullable first)
ALTER TABLE "opportunity_tracker"."User" ADD COLUMN "organizationId" TEXT;

-- Step 9: Assign users to their organizations
UPDATE "opportunity_tracker"."User" SET "organizationId" = 'org-' || id;

-- Step 10: Add role and managerId columns to User table
ALTER TABLE "opportunity_tracker"."User" ADD COLUMN "role" "opportunity_tracker"."UserRole" NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "opportunity_tracker"."User" ADD COLUMN "managerId" TEXT;

-- Step 11: Make organizationId NOT NULL now that it's populated
ALTER TABLE "opportunity_tracker"."User" ALTER COLUMN "organizationId" SET NOT NULL;

-- Step 12: Add organizationId to Opportunity table (nullable first)
ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN "organizationId" TEXT;

-- Step 13: Assign opportunities to organizations based on owner
UPDATE "opportunity_tracker"."Opportunity"
SET "organizationId" = (
  SELECT "organizationId"
  FROM "opportunity_tracker"."User"
  WHERE "User".id = "Opportunity"."ownerId"
);

-- Step 14: Make organizationId NOT NULL
ALTER TABLE "opportunity_tracker"."Opportunity" ALTER COLUMN "organizationId" SET NOT NULL;

-- Step 15: Add organizationId and ownerId to Account table (nullable first)
ALTER TABLE "opportunity_tracker"."Account" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "opportunity_tracker"."Account" ADD COLUMN "ownerId" TEXT;

-- Step 16: Assign accounts to organizations (use first opportunity's org)
UPDATE "opportunity_tracker"."Account"
SET "organizationId" = (
  SELECT "organizationId"
  FROM "opportunity_tracker"."Opportunity"
  WHERE "Opportunity"."accountId" = "Account".id
  LIMIT 1
);

-- Step 17: For accounts with no opportunities, assign to first organization
UPDATE "opportunity_tracker"."Account"
SET "organizationId" = (SELECT id FROM "opportunity_tracker"."Organization" LIMIT 1)
WHERE "organizationId" IS NULL;

-- Step 18: Assign account owners (use first opportunity's owner)
UPDATE "opportunity_tracker"."Account"
SET "ownerId" = (
  SELECT "ownerId"
  FROM "opportunity_tracker"."Opportunity"
  WHERE "Opportunity"."accountId" = "Account".id
  LIMIT 1
);

-- Step 19: Make organizationId NOT NULL for Account
ALTER TABLE "opportunity_tracker"."Account" ALTER COLUMN "organizationId" SET NOT NULL;

-- Step 20: Drop unique constraint on Account name (will be scoped to org)
ALTER TABLE "opportunity_tracker"."Account" DROP CONSTRAINT IF EXISTS "Account_name_key";

-- Step 21: Create KanbanViews for each user from their existing columns
INSERT INTO "opportunity_tracker"."KanbanView" (id, name, "viewType", "isActive", "isDefault", "userId", "createdAt", "updatedAt")
SELECT
  'view-' || COALESCE("userId", 'default'),
  'My Custom View',
  'custom'::"opportunity_tracker"."ViewType",
  true,
  true,
  "userId",
  NOW(),
  NOW()
FROM "opportunity_tracker"."KanbanColumn"
WHERE "userId" IS NOT NULL
GROUP BY "userId";

-- Step 22: Add viewId column to KanbanColumn (nullable first)
ALTER TABLE "opportunity_tracker"."KanbanColumn" ADD COLUMN "viewId" TEXT;

-- Step 23: Assign columns to views
UPDATE "opportunity_tracker"."KanbanColumn"
SET "viewId" = 'view-' || "userId"
WHERE "userId" IS NOT NULL;

-- Step 24: For global columns (userId IS NULL), create an orphaned view or delete them
DELETE FROM "opportunity_tracker"."KanbanColumn" WHERE "userId" IS NULL;

-- Step 25: Make viewId NOT NULL
ALTER TABLE "opportunity_tracker"."KanbanColumn" ALTER COLUMN "viewId" SET NOT NULL;

-- Step 26: Drop old constraints and columns from KanbanColumn
ALTER TABLE "opportunity_tracker"."KanbanColumn" DROP CONSTRAINT IF EXISTS "KanbanColumn_userId_order_key";
ALTER TABLE "opportunity_tracker"."KanbanColumn" DROP COLUMN "userId";

-- Step 27: Create unique indexes
CREATE UNIQUE INDEX "Organization_domain_key" ON "opportunity_tracker"."Organization"("domain");
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "opportunity_tracker"."OrganizationSettings"("organizationId");
CREATE UNIQUE INDEX "Invitation_token_key" ON "opportunity_tracker"."Invitation"("token");
CREATE UNIQUE INDEX "Invitation_organizationId_email_key" ON "opportunity_tracker"."Invitation"("organizationId", "email");
CREATE UNIQUE INDEX "Account_organizationId_name_key" ON "opportunity_tracker"."Account"("organizationId", "name");
CREATE UNIQUE INDEX "KanbanView_userId_name_key" ON "opportunity_tracker"."KanbanView"("userId", "name");
CREATE UNIQUE INDEX "KanbanView_organizationId_name_key" ON "opportunity_tracker"."KanbanView"("organizationId", "name");
CREATE UNIQUE INDEX "KanbanColumn_viewId_order_key" ON "opportunity_tracker"."KanbanColumn"("viewId", "order");

-- Step 28: Create regular indexes
CREATE INDEX "KanbanView_userId_isActive_idx" ON "opportunity_tracker"."KanbanView"("userId", "isActive");
CREATE INDEX "KanbanView_organizationId_isActive_idx" ON "opportunity_tracker"."KanbanView"("organizationId", "isActive");

-- Step 29: Add foreign key constraints
ALTER TABLE "opportunity_tracker"."User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "opportunity_tracker"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunity_tracker"."User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "opportunity_tracker"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "opportunity_tracker"."OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "opportunity_tracker"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "opportunity_tracker"."Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "opportunity_tracker"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunity_tracker"."Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "opportunity_tracker"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "opportunity_tracker"."Account" ADD CONSTRAINT "Account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "opportunity_tracker"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunity_tracker"."Account" ADD CONSTRAINT "Account_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "opportunity_tracker"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "opportunity_tracker"."Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "opportunity_tracker"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "opportunity_tracker"."KanbanView" ADD CONSTRAINT "KanbanView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "opportunity_tracker"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunity_tracker"."KanbanView" ADD CONSTRAINT "KanbanView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "opportunity_tracker"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "opportunity_tracker"."KanbanColumn" ADD CONSTRAINT "KanbanColumn_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "opportunity_tracker"."KanbanView"("id") ON DELETE CASCADE ON UPDATE CASCADE;
