import { prisma } from "@/lib/db";
import { calculateDashboardStats } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { Target, DollarSign, Trophy } from "lucide-react";
import { UpcomingMeetingsWidget } from "@/components/calendar/upcoming-meetings-widget";
import { UpcomingTasksWidget } from "@/components/tasks/upcoming-tasks-widget";
import { requireAuthOrRedirect } from "@/lib/auth";
import { addMonths, isWithinInterval } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Check authentication and get user with organization
  const user = await requireAuthOrRedirect();

  // Fetch opportunities for stats (scoped by organization)
  const opportunitiesFromDB = await prisma.opportunity.findMany({
    where: {
      organizationId: user.organization.id,
    },
    include: {
      owner: true,
      account: true,
    },
    orderBy: { updatedAt: "desc" },
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
      website: opp.account.website || undefined,
    } : undefined,
    amountArr: opp.amountArr,
    confidenceLevel: opp.confidenceLevel,
    nextStep: opp.nextStep || undefined,
    closeDate: opp.closeDate?.toISOString() || undefined,
    quarter: opp.quarter || undefined,
    stage: opp.stage,
    owner: {
      id: opp.owner.id,
      name: opp.owner.name || "Unknown",
      avatarUrl: opp.owner.avatarUrl || undefined,
    },
    createdAt: opp.createdAt.toISOString(),
    updatedAt: opp.updatedAt.toISOString(),
  }));

  const stats = calculateDashboardStats(opportunities);

  // Calculate fiscal year closed won for quota attainment
  const fiscalYearStartMonth = user.organization.fiscalYearStartMonth;
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const fiscalYearStartYear = currentMonth >= fiscalYearStartMonth
    ? now.getFullYear()
    : now.getFullYear() - 1;
  const fiscalYearStart = new Date(fiscalYearStartYear, fiscalYearStartMonth - 1, 1);
  const fiscalYearEnd = addMonths(fiscalYearStart, 12);

  // Filter closed won opportunities in current fiscal year
  const fiscalYearClosedWon = opportunitiesFromDB
    .filter(opp =>
      opp.stage === "closedWon" &&
      opp.closeDate &&
      isWithinInterval(new Date(opp.closeDate), { start: fiscalYearStart, end: fiscalYearEnd })
    )
    .reduce((sum, opp) => sum + opp.amountArr, 0);

  // Calculate quota attainment percentage
  const quotaAttainment = user.annualQuota && user.annualQuota > 0
    ? Math.round((fiscalYearClosedWon / user.annualQuota) * 100)
    : null;

  const stageLabels: Record<string, string> = {
    discovery: "Discovery",
    demo: "Demo",
    validateSolution: "Validate Solution",
    decisionMakerApproval: "Decision Maker Approval",
    contracting: "Contracting",
    closedWon: "Closed Won",
    closedLost: "Closed Lost",
  };

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your opportunities and key metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOpportunities}</div>
            <p className="text-xs text-muted-foreground">Active deals in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" suppressHydrationWarning>{formatCurrencyCompact(stats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">Total ARR in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quota Attainment</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {quotaAttainment !== null ? (
              <>
                <div className="text-2xl font-bold">{quotaAttainment}%</div>
                <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {formatCurrencyCompact(fiscalYearClosedWon)} of {formatCurrencyCompact(user.annualQuota!)} closed
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">--</div>
                <p className="text-xs text-muted-foreground">
                  No quota set.{" "}
                  <Link href="/settings" className="text-primary hover:underline">
                    Set quota
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Time-sensitive widgets: Meetings and Tasks */}
      <div className="grid gap-6 md:grid-cols-2">
        <UpcomingMeetingsWidget />
        <UpcomingTasksWidget />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* By Quarter */}
        <Card>
          <CardHeader>
            <CardTitle>Forecast by Quarter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.byQuarter.map((quarter) => (
                <div key={quarter.quarter} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{quarter.quarter}</div>
                    <Badge variant="secondary">{quarter.count} deals</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Value</span>
                    <span className="font-medium" suppressHydrationWarning>{formatCurrency(quarter.value)}</span>
                  </div>
                </div>
              ))}
              {stats.byQuarter.length === 0 && (
                <p className="text-sm text-muted-foreground">No quarterly data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* By Stage */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.byStage.map((stage) => (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{stageLabels[stage.stage] || stage.stage}</div>
                    <Badge variant="secondary">{stage.count} deals</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Value</span>
                    <span className="font-medium" suppressHydrationWarning>{formatCurrency(stage.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
