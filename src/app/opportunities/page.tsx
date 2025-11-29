// app/opportunities/page.tsx
// Displays a Kanban view of opportunities with view management

import { KanbanBoardWrapper } from "@/components/kanban/KanbanBoardWrapper";
import { prisma } from "@/lib/db";
import { requireAuthOrRedirect } from "@/lib/auth";
import { SerializedKanbanView } from "@/types/view";
import { getAllBuiltInViews } from "@/lib/utils/built-in-views";
import { getVisibleUserIds, isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  // Require authentication - redirects to /auth/login if not authenticated
  // Note: Do NOT wrap in try-catch as redirect() throws a special error
  const user = await requireAuthOrRedirect();

  // Get organization's fiscal year settings
  const fiscalYearStartMonth = user.organization?.fiscalYearStartMonth ?? 1;

  // Fetch custom views from database (user-specific + organization-specific)
  const dbViews = await prisma.kanbanView.findMany({
    where: {
      OR: [
        { userId: user.id },
        { organizationId: null, userId: null }, // Global views
      ],
    },
    include: {
      columns: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: [
      { isActive: "desc" },
      { lastAccessedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  // Transform custom views to serialized format
  const customViews: SerializedKanbanView[] = dbViews.map((view) => ({
    id: view.id,
    name: view.name,
    viewType: view.viewType,
    isActive: view.isActive,
    isDefault: view.isDefault,
    userId: view.userId,
    organizationId: view.organizationId,
    lastAccessedAt: view.lastAccessedAt?.toISOString() || null,
    isShared: view.isShared,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
    columns: view.columns.map((col) => ({
      id: col.id,
      title: col.title,
      order: col.order,
      color: col.color,
      viewId: col.viewId,
      createdAt: col.createdAt.toISOString(),
      updatedAt: col.updatedAt.toISOString(),
    })),
  }));

  // Generate built-in views
  const builtInViews = getAllBuiltInViews(fiscalYearStartMonth, user.id);

  // Combine all views (built-in first, then custom)
  const allViews = [...builtInViews, ...customViews];

  // Determine active view
  // Priority: 1) Active custom view, 2) Default custom view, 3) Quarterly view (first built-in)
  let activeView = customViews.find((v) => v.isActive);
  if (!activeView) {
    activeView = customViews.find((v) => v.isDefault);
  }
  if (!activeView) {
    activeView = builtInViews[0]; // Default to Quarterly View
  }

  // Check if user is new (no custom views)
  const isNewUser = customViews.length === 0;

  // Build visibility filter based on user role
  const visibleUserIds = getVisibleUserIds(user, user.directReports);
  const whereClause = isAdmin(user)
    ? { organizationId: user.organization.id } // Admin sees all in org
    : { ownerId: { in: visibleUserIds } }; // Others see based on visibility

  // Fetch opportunities from database with proper scoping
  const opportunitiesFromDB = await prisma.opportunity.findMany({
    where: whereClause,
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
    account: opp.account
      ? {
          id: opp.account.id,
          name: opp.account.name,
          website: opp.account.website || undefined,
        }
      : undefined,
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
    owner: opp.owner
      ? {
          id: opp.owner.id,
          name: opp.owner.name || "Unknown",
          email: opp.owner.email || undefined,
          avatarUrl: opp.owner.avatarUrl || undefined,
        }
      : {
          id: opp.ownerId,
          name: "Unknown",
          email: undefined,
          avatarUrl: undefined,
        },
    createdAt: opp.createdAt.toISOString(),
    updatedAt: opp.updatedAt.toISOString(),
  }));

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Track deals, next steps, and forecast across multiple views
        </p>
      </div>
      <KanbanBoardWrapper
        opportunities={opportunities}
        views={allViews}
        activeView={activeView}
        isNewUser={isNewUser}
        userId={user.id}
        fiscalYearStartMonth={fiscalYearStartMonth}
      />
    </div>
  );
}
