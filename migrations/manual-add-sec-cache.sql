-- Manual migration: Add SecCompanyCache table
-- Run this SQL on your database to add the SEC company cache table

CREATE TABLE "opportunity_tracker"."SecCompanyCache" (
    "id" TEXT NOT NULL,
    "cik" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecCompanyCache_pkey" PRIMARY KEY ("id")
);

-- Create unique index on CIK
CREATE UNIQUE INDEX "SecCompanyCache_cik_key" ON "opportunity_tracker"."SecCompanyCache"("cik");

-- Create indexes for fast searching
CREATE INDEX "SecCompanyCache_name_idx" ON "opportunity_tracker"."SecCompanyCache"("name");
CREATE INDEX "SecCompanyCache_ticker_idx" ON "opportunity_tracker"."SecCompanyCache"("ticker");
