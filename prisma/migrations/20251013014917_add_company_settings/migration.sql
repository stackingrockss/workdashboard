-- CreateTable
CREATE TABLE "opportunity_tracker"."CompanySettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "companyWebsite" TEXT,
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_userId_key" ON "opportunity_tracker"."CompanySettings"("userId");

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."CompanySettings" ADD CONSTRAINT "CompanySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "opportunity_tracker"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
