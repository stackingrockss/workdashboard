import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WhiteboardTable } from "@/components/whiteboard/WhiteboardTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Opportunity } from "@/types/opportunity";

export default async function WhiteboardingPage() {
  const user = await requireAuth();

  // Fetch opportunities for the authenticated user (only pinned to whiteboard)
  const opportunitiesFromDB = await prisma.opportunity.findMany({
    where: {
      ownerId: user.id,
      pinnedToWhiteboard: true,
    },
    include: {
      owner: true,
      account: true,
    },
    orderBy: { closeDate: "asc" },
  });

  // Map Prisma results to Opportunity type (convert null to undefined)
  const opportunities: Opportunity[] = opportunitiesFromDB.map(opp => ({
    id: opp.id,
    name: opp.name,
    accountId: opp.accountId || undefined,
    accountName: opp.accountName || undefined,
    account: opp.account ? {
      id: opp.account.id,
      name: opp.account.name,
    } : undefined,
    amountArr: opp.amountArr,
    confidenceLevel: opp.confidenceLevel,
    nextStep: opp.nextStep || undefined,
    closeDate: opp.closeDate?.toISOString() || undefined,
    quarter: opp.quarter || undefined,
    stage: opp.stage,
    columnId: opp.columnId || undefined,
    forecastCategory: opp.forecastCategory || undefined,
    riskNotes: opp.riskNotes || undefined,
    notes: opp.notes || undefined,
    accountResearch: opp.accountResearch || undefined,
    decisionMakers: opp.decisionMakers || undefined,
    competition: opp.competition || undefined,
    legalReviewStatus: opp.legalReviewStatus || undefined,
    securityReviewStatus: opp.securityReviewStatus || undefined,
    platformType: opp.platformType || undefined,
    businessCaseStatus: opp.businessCaseStatus || undefined,
    pinnedToWhiteboard: opp.pinnedToWhiteboard,
    owner: {
      id: opp.owner.id,
      name: opp.owner.name,
      email: opp.owner.email,
    },
    createdAt: opp.createdAt.toISOString(),
    updatedAt: opp.updatedAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Whiteboarding</h1>
          <p className="text-muted-foreground mt-1">
            Spreadsheet-style view of all your opportunities with inline editing
          </p>
        </div>
        <Button asChild>
          <Link href="/opportunities">
            <Plus className="h-4 w-4 mr-2" />
            New Opportunity
          </Link>
        </Button>
      </div>

      {opportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-lg">
          <h3 className="text-lg font-medium mb-2">No pinned opportunities yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Pin opportunities from the Kanban board or opportunities list to see them here
          </p>
          <Button asChild>
            <Link href="/opportunities">
              <Plus className="h-4 w-4 mr-2" />
              View Opportunities
            </Link>
          </Button>
        </div>
      ) : (
        <WhiteboardTable opportunities={opportunities} />
      )}
    </div>
  );
}
