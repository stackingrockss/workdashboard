-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "opportunity_tracker";

-- CreateEnum
CREATE TYPE "opportunity_tracker"."OpportunityStage" AS ENUM ('prospect', 'qualification', 'proposal', 'negotiation', 'closedWon', 'closedLost');

-- CreateEnum
CREATE TYPE "opportunity_tracker"."ForecastCategory" AS ENUM ('pipeline', 'bestCase', 'forecast');

-- CreateEnum
CREATE TYPE "opportunity_tracker"."ContactRole" AS ENUM ('decision_maker', 'influencer', 'champion', 'blocker', 'end_user');

-- CreateEnum
CREATE TYPE "opportunity_tracker"."ContactSentiment" AS ENUM ('advocate', 'positive', 'neutral', 'negative', 'unknown');

-- CreateTable
CREATE TABLE "opportunity_tracker"."User" (
    "id" TEXT NOT NULL,
    "supabaseId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_tracker"."Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "health" TEXT NOT NULL DEFAULT 'good',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_tracker"."KanbanColumn" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_tracker"."Opportunity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountArr" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL,
    "nextStep" TEXT,
    "closeDate" TIMESTAMP(3),
    "stage" "opportunity_tracker"."OpportunityStage" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT,
    "accountName" TEXT,
    "quarter" TEXT,
    "forecastCategory" "opportunity_tracker"."ForecastCategory",
    "notes" TEXT,
    "riskNotes" TEXT,
    "columnId" TEXT,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_tracker"."GranolaNote" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GranolaNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_tracker"."GongCall" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GongCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_tracker"."GoogleNote" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_tracker"."Contact" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "role" "opportunity_tracker"."ContactRole" NOT NULL,
    "sentiment" "opportunity_tracker"."ContactSentiment" NOT NULL DEFAULT 'unknown',
    "opportunityId" TEXT NOT NULL,
    "managerId" TEXT,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "opportunity_tracker"."User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "opportunity_tracker"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "opportunity_tracker"."Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "KanbanColumn_userId_order_key" ON "opportunity_tracker"."KanbanColumn"("userId", "order");

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."KanbanColumn" ADD CONSTRAINT "KanbanColumn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "opportunity_tracker"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."Opportunity" ADD CONSTRAINT "Opportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "opportunity_tracker"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "opportunity_tracker"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."GranolaNote" ADD CONSTRAINT "GranolaNote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_tracker"."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."GongCall" ADD CONSTRAINT "GongCall_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_tracker"."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."GoogleNote" ADD CONSTRAINT "GoogleNote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_tracker"."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."Contact" ADD CONSTRAINT "Contact_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "opportunity_tracker"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_tracker"."Contact" ADD CONSTRAINT "Contact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity_tracker"."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

