// app/opportunities/page.tsx
// Displays a Kanban view of opportunities fetched from the database

import { KanbanBoardWrapper } from "@/components/kanban/KanbanBoardWrapper";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getQuarterlyTemplate, prepareTemplateForCreation } from "@/lib/templates/column-templates";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  // Require authentication
  const user = await requireAuth();

  // Get user's fiscal year settings
  const settings = await prisma.companySettings.findUnique({
    where: { userId: user.id },
  });
  const fiscalYearStartMonth = settings?.fiscalYearStartMonth ?? 1;

  // Fetch columns from database (user-specific + global)
  const columnsFromDB = await prisma.kanbanColumn.findMany({
    where: {
      OR: [{ userId: user.id }, { userId: null }],
    },
    orderBy: { order: "asc" },
  });

  // Auto-create quarterly columns for new users (Option A)
  let finalColumns = columnsFromDB;
  if (columnsFromDB.length === 0) {
    console.log("No columns found for user, auto-creating quarterly template...");

    // Get quarterly template
    const template = getQuarterlyTemplate(fiscalYearStartMonth);
    const columnsToCreate = prepareTemplateForCreation(template);

    // Create columns in database
    const createdColumns = await Promise.all(
      columnsToCreate.map((col) =>
        prisma.kanbanColumn.create({
          data: {
            title: col.title,
            order: col.order,
            color: col.color || null,
            userId: user.id,
          },
        })
      )
    );

    finalColumns = createdColumns;
    console.log(`Auto-created ${createdColumns.length} quarterly columns for new user`);
  }

  // Transform columns to match expected type
  const columns = finalColumns.map((col) => ({
    id: col.id,
    title: col.title,
    order: col.order,
    color: col.color || undefined,
    userId: col.userId || undefined,
    createdAt: col.createdAt.toISOString(),
    updatedAt: col.updatedAt.toISOString(),
  }));

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
    columnId: opp.columnId || undefined,
    forecastCategory: opp.forecastCategory || undefined,
    riskNotes: opp.riskNotes || undefined,
    notes: opp.notes || undefined,
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
      <KanbanBoardWrapper
        opportunities={opportunities}
        initialColumns={columns}
        fiscalYearStartMonth={fiscalYearStartMonth}
      />
    </div>
  );
}


