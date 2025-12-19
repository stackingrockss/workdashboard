"use client";

// Summary card showing aggregated insights across all parsed calls
// Displays stats and collapsible sections for pain points, goals, and next steps

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Phone,
  Calendar,
  Lightbulb,
  AlertTriangle,
  Target,
  ListChecks,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AggregatedInsights, AggregatedInsightItem } from "@/types/activity";

interface ActivityInsightsSummaryCardProps {
  insights: AggregatedInsights;
  isLoading: boolean;
}

interface InsightSectionProps {
  title: string;
  items: AggregatedInsightItem[];
  icon: React.ReactNode;
  iconBgClass: string;
  defaultOpen?: boolean;
}

function InsightSection({
  title,
  items,
  icon,
  iconBgClass,
  defaultOpen = false,
}: InsightSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  if (items.length === 0) return null;

  const handleCopy = async () => {
    try {
      const text = items.map((item) => `- ${item.text}`).join("\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${title} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  iconBgClass
                )}
              >
                {icon}
              </div>
              <span className="font-medium text-sm">{title}</span>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-2">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1" />
                )}
                Copy all
              </Button>
            </div>
            <ul className="space-y-1.5">
              {items.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <span>{item.text}</span>
                    {item.mentionCount > 1 && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] px-1 py-0"
                      >
                        {item.mentionCount}x
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
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
      <CardHeader className="pb-3">
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

      {totalInsightsCount > 0 && (
        <CardContent className="pt-0 space-y-2">
          <InsightSection
            title="Pain Points"
            items={insights.painPoints}
            icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
            iconBgClass="bg-orange-100 dark:bg-orange-950"
            defaultOpen={insights.painPoints.length > 0}
          />

          <InsightSection
            title="Goals"
            items={insights.goals}
            icon={<Target className="h-4 w-4 text-blue-600" />}
            iconBgClass="bg-blue-100 dark:bg-blue-950"
          />

          <InsightSection
            title="Next Steps"
            items={insights.nextSteps}
            icon={<ListChecks className="h-4 w-4 text-green-600" />}
            iconBgClass="bg-green-100 dark:bg-green-950"
          />
        </CardContent>
      )}
    </Card>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-48" />
        <div className="flex gap-4 mt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}
