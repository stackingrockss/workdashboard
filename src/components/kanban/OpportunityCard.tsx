"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Opportunity } from "@/types/opportunity";
import { ArrowRight, AlertTriangle, Pin, CalendarClock, Mail, CalendarPlus } from "lucide-react";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FORECAST_LABELS } from "@/lib/constants";
import { isCbcDue, isCbcOverdue, getDaysUntilCbc } from "@/lib/utils/cbc-calculator";

export interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick?: (opportunityId: string) => void;
  showOwner?: boolean; // For managers viewing their team's opportunities
}

export function OpportunityCard({ opportunity, onClick, showOwner = false }: OpportunityCardProps) {
  const router = useRouter();
  const [isPinned, setIsPinned] = useState(opportunity.pinnedToWhiteboard ?? false);
  const [isPinning, setIsPinning] = useState(false);

  const initials = opportunity.owner.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const closeDate = formatDateShort(opportunity.closeDate);

  // CBC (Contact Before Call) status
  const cbcStatus = useMemo(() => {
    const cbcDate = opportunity.cbc ? new Date(opportunity.cbc) : null;
    const isDue = isCbcDue(cbcDate);
    const isOverdue = isCbcOverdue(cbcDate);
    const daysUntil = getDaysUntilCbc(cbcDate);

    return {
      date: cbcDate,
      isDue,
      isOverdue,
      daysUntil,
      needsNextCall: opportunity.needsNextCallScheduled ?? false,
    };
  }, [opportunity.cbc, opportunity.needsNextCallScheduled]);

  const handlePinToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinning(true);

    try {
      const response = await fetch(`/api/v1/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedToWhiteboard: !isPinned }),
      });

      if (!response.ok) throw new Error("Failed to update pin status");

      setIsPinned(!isPinned);
      toast.success(isPinned ? "Unpinned from whiteboard" : "Pinned to whiteboard");
      router.refresh();
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      toast.error("Failed to update pin status. Please try again.");
    } finally {
      setIsPinning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(opportunity.id);
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() => onClick?.(opportunity.id)}
    >
      <CardContent className="p-3 space-y-2">
        {/* Row 1: Name + Pin button */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="font-medium truncate leading-tight">{opportunity.name}</div>
                </TooltipTrigger>
                <TooltipContent><p>{opportunity.name}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 -mt-0.5 -mr-1"
            onClick={handlePinToggle}
            disabled={isPinning}
            aria-label={isPinned ? "Unpin from whiteboard" : "Pin to whiteboard"}
          >
            <Pin size={12} className={isPinned ? "fill-current text-primary" : "text-muted-foreground"} />
          </Button>
        </div>

        {/* Row 2: ARR + Close date on same line */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400" suppressHydrationWarning>
            {formatCurrencyCompact(opportunity.amountArr)}
          </span>
          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
            {closeDate}
          </span>
        </div>

        {/* Row 4: Badges row - confidence + forecast category */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            {opportunity.confidenceLevel}/5
          </Badge>
          {opportunity.forecastCategory && (
            <Badge
              variant={opportunity.forecastCategory === "commit" ? "default" : "outline"}
              className="text-[10px] px-1.5 py-0 h-5"
            >
              {FORECAST_LABELS[opportunity.forecastCategory]}
            </Badge>
          )}
          {opportunity.riskNotes && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                    <AlertTriangle size={10} />
                    Risk
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-xs">{opportunity.riskNotes}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Row 5: Next call date (if exists) */}
        {opportunity.nextCallDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3 w-3 shrink-0" />
            <span suppressHydrationWarning>Next: {formatDateShort(opportunity.nextCallDate)}</span>
            {opportunity.nextCallDateSource === 'auto_calendar' && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Auto</Badge>
            )}
          </div>
        )}

        {/* Row 6: CBC indicator (needs call or reach out) */}
        {cbcStatus.needsNextCall && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <CalendarPlus className="h-3 w-3 shrink-0" />
                  <span className="font-medium">Schedule next call</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>No upcoming meeting scheduled</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {cbcStatus.date && !cbcStatus.needsNextCall && (cbcStatus.isDue || cbcStatus.isOverdue) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-1.5 text-xs ${
                  cbcStatus.isOverdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  <Mail className="h-3 w-3 shrink-0" />
                  <span>
                    {cbcStatus.isOverdue
                      ? `Overdue ${Math.abs(cbcStatus.daysUntil!)}d`
                      : "Reach out today"
                    }
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Contact Before Call - time to reach out</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Row 6: Next step (if exists) */}
        {opportunity.nextStep && (
          <div className="flex items-start gap-1.5 text-muted-foreground pt-0.5">
            <ArrowRight size={12} className="mt-0.5 shrink-0" />
            <p className="text-xs line-clamp-2 leading-snug">
              {opportunity.nextStep.split('\n').filter(Boolean)[0]}
            </p>
          </div>
        )}

        {/* Row 7: Owner (only for managers viewing team) */}
        {showOwner && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{opportunity.owner.name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OpportunityCard;


