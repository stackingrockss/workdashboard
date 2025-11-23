import { prisma } from "@/lib/db";
import { calculateDashboardStats } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { TrendingUp, Target, DollarSign, Award } from "lucide-react";
import Link from "next/link";
import { UpcomingMeetingsWidget } from "@/components/calendar/upcoming-meetings-widget";
import { UpcomingTasksWidget } from "@/components/tasks/upcoming-tasks-widget";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fetch opportunities for stats
  const opportunitiesFromDB = await prisma.opportunity.findMany({
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

  const stageLabels: Record<string, string> = {
    prospect: "Prospect",
    qualification: "Qualification",
    proposal: "Proposal",
    negotiation: "Negotiation",
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Weighted Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" suppressHydrationWarning>{formatCurrencyCompact(stats.weightedValue)}</div>
            <p className="text-xs text-muted-foreground">Probability-adjusted ARR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.wonOpportunities} won / {stats.wonOpportunities + stats.lostOpportunities} closed
            </p>
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
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Weighted Value</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400" suppressHydrationWarning>
                      {formatCurrency(quarter.weightedValue)}
                    </span>
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

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start justify-between">
                <div className="space-y-1">
                  <Link
                    href={`/opportunities/${activity.id}`}
                    className="font-medium hover:underline"
                  >
                    {activity.name}
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    {activity.accountName} • {activity.action}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
                  {new Date(activity.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
            {stats.recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href="/opportunities"
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            View Opportunities
          </Link>
          <Link
            href="/prospects"
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Manage Prospects
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
