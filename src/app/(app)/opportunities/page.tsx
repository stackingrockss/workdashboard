// app/opportunities/page.tsx
// Displays a Kanban view of opportunities with view management

import { cookies } from "next/headers";
import { KanbanBoardWrapper } from "@/components/kanban/KanbanBoardWrapper";
import { prisma } from "@/lib/db";
import { requireAuthOrRedirect } from "@/lib/auth";
import { SerializedKanbanView } from "@/types/view";
import { getAllBuiltInViews } from "@/lib/utils/built-in-views";
import { getVisibleUserIds, isAdmin } from "@/lib/permissions";
import { Target } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyCompact } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  // Require authentication - redirects to /auth/login if not authenticated
  // Note: Do NOT wrap in try-catch as redirect() throws a special error
  const user = await requireAuthOrRedirect();

  // Get organization's fiscal year settings
  const fiscalYearStartMonth = user.organization?.fiscalYearStartMonth ?? 1;

  // Generate built-in views
  const builtInViews = getAllBuiltInViews(fiscalYearStartMonth, user.id);

  // Check if user has selected a view (stored in cookie for server-side access)
  const cookieStore = await cookies();
  const selectedViewId = cookieStore.get("selected-built-in-view")?.value;

  // Determine active view from cookie or default to first built-in view (Quarterly)
  let activeView: SerializedKanbanView | undefined;
  if (selectedViewId) {
    activeView = builtInViews.find((v) => v.id === selectedViewId);
  }
  if (!activeView) {
    activeView = builtInViews[0]; // Default to Quarterly View
  }

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

  // Calculate pipeline stats for header
  const totalPipeline = opportunities
    .filter((o) => !["closedWon", "closedLost"].includes(o.stage))
    .reduce((sum, o) => sum + o.amountArr, 0);
  const activeDeals = opportunities.filter(
    (o) => !["closedWon", "closedLost"].includes(o.stage)
  ).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
            <p className="text-sm text-muted-foreground">
              Track deals, next steps, and forecast
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-6">
          <div className="text-right">
            <p className="text-xl font-semibold">{activeDeals}</p>
            <p className="text-xs text-muted-foreground">Active Deals</p>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-right">
            <p className="text-xl font-semibold text-emerald-600" suppressHydrationWarning>
              {formatCurrencyCompact(totalPipeline)}
            </p>
            <p className="text-xs text-muted-foreground">Pipeline</p>
          </div>
        </div>
      </div>
      <KanbanBoardWrapper
        opportunities={opportunities}
        views={builtInViews}
        activeView={activeView}
        fiscalYearStartMonth={fiscalYearStartMonth}
      />
    </div>
  );
}
