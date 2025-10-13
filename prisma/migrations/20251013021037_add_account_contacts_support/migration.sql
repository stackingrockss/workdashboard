-- AlterTable
ALTER TABLE "opportunity_tracker"."Contact" ADD COLUMN     "accountId" TEXT,
ALTER COLUMN "opportunityId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "opportunity_tracker"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
