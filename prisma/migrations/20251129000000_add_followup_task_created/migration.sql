-- AlterTable
ALTER TABLE "opportunity_tracker"."CalendarEvent" ADD COLUMN IF NOT EXISTS "followupTaskCreated" BOOLEAN DEFAULT false;