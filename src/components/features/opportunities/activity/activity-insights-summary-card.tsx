// Minimal summary card showing activity stats
// Displays meeting count, parsed calls count, and insights extracted

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Calendar, Lightbulb } from "lucide-react";
import type { AggregatedInsights } from "@/types/activity";

interface ActivityInsightsSummaryCardProps {
  insights: AggregatedInsights;
  isLoading: boolean;
}

export function ActivityInsightsSummaryCard({
  insights,
  isLoading,
}: ActivityInsightsSummaryCardProps) {
  if (isLoading) {
    return <SummaryCardSkeleton />;
  }

  const { totalMeetings, parsedCallsCount, totalInsightsCount } = insights;

  // Don't show if no meetings
  if (totalMeetings === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Activity Insights Summary
          </CardTitle>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>
              {totalMeetings} meeting{totalMeetings !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="h-4 w-4" />
            <span>
              {parsedCallsCount} call{parsedCallsCount !== 1 ? "s" : ""} parsed
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4" />
            <span>
              {totalInsightsCount} insight{totalInsightsCount !== 1 ? "s" : ""}{" "}
              extracted
            </span>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="py-3">
        <Skeleton className="h-5 w-48" />
        <div className="flex gap-4 mt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardHeader>
    </Card>
  );
}
