/*
  Warnings:

  - Added the required column `meetingDate` to the `GongCall` table without a default value. This is not possible if the table is not empty.
  - Added the required column `meetingDate` to the `GranolaNote` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "opportunity_tracker"."GongCall" ADD COLUMN     "meetingDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "opportunity_tracker"."GranolaNote" ADD COLUMN     "meetingDate" TIMESTAMP(3) NOT NULL;
