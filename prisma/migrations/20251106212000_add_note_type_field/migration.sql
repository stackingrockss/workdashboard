-- CreateEnum for NoteType (if not exists)
DO $$ BEGIN
  CREATE TYPE "opportunity_tracker"."NoteType" AS ENUM ('customer', 'internal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add noteType to GranolaNote table
ALTER TABLE "opportunity_tracker"."GranolaNote"
ADD COLUMN IF NOT EXISTS "noteType" "opportunity_tracker"."NoteType" DEFAULT 'customer';

-- AlterTable: Add noteType to GongCall table
ALTER TABLE "opportunity_tracker"."GongCall"
ADD COLUMN IF NOT EXISTS "noteType" "opportunity_tracker"."NoteType" DEFAULT 'customer';
