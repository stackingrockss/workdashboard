// app/opportunities/page.tsx
// Displays a Kanban view of opportunities fetched from the database

import { KanbanBoardWrapper } from "@/components/kanban/KanbanBoardWrapper";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  // Fetch opportunities from database
  const opportunitiesFromDB = await prisma.opportunity.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      owner: true,
      account: true,
    },
    take: 100,
  });

  // Transform to match the expected Opportunity type
  const opportunities = opportunitiesFromDB.map((opp) => ({
    id: opp.id,
    name: opp.name,
    accountId: opp.accountId || undefined,
    accountName: opp.accountName || undefined,
    account: opp.account ? {
      id: opp.account.id,
      name: opp.account.name,
    } : undefined,
    amountArr: opp.amountArr,
    probability: opp.probability,
    nextStep: opp.nextStep || undefined,
    closeDate: opp.closeDate?.toISOString() || undefined,
    quarter: opp.quarter || undefined,
    stage: opp.stage,
    owner: {
      id: opp.owner.id,
      name: opp.owner.name,
      avatarUrl: opp.owner.avatarUrl || undefined,
    },
    createdAt: opp.createdAt.toISOString(),
    updatedAt: opp.updatedAt.toISOString(),
  }));

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Track deals, next steps, and forecast in a Kanban view
        </p>
      </div>
      <KanbanBoardWrapper opportunities={opportunities} />
    </div>
  );
}


