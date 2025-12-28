"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Opportunity } from "@/types/opportunity";
import { CalendarDays, ArrowRight, AlertTriangle, Pin, ExternalLink, CalendarClock, CheckCircle, Mail, CalendarPlus } from "lucide-react";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FORECAST_LABELS } from "@/lib/constants";
import { isCbcDue, isCbcOverdue, getDaysUntilCbc } from "@/lib/utils/cbc-calculator";

export interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick?: (opportunityId: string) => void;
}

export function OpportunityCard({ opportunity, onClick }: OpportunityCardProps) {
  const router = useRouter();
  const [isPinned, setIsPinned] = useState(opportunity.pinnedToWhiteboard ?? false);
  const [isPinning, setIsPinning] = useState(false);

  const initials = opportunity.owner.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const closeDate = formatDateShort(opportunity.closeDate);
  const accountName = opportunity.account?.name || opportunity.accountName || "No Account";
  const accountWebsite = opportunity.account?.website;

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
    e.stopPropagation(); // Prevent card click
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
      router.refresh(); // Refresh server components
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
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="truncate font-medium">{opportunity.name}</div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{opportunity.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="truncate text-muted-foreground text-sm">{accountName}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{accountName}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {accountWebsite && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={accountWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Visit {accountName} website</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          <div className="flex items-start gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePinToggle}
              disabled={isPinning}
              aria-label={isPinned ? "Unpin from whiteboard" : "Pin to whiteboard"}
              title={isPinned ? "Unpin from whiteboard" : "Pin to whiteboard"}
            >
              <Pin
                size={14}
                className={isPinned ? "fill-current text-primary" : ""}
              />
            </Button>
            <div className="flex flex-col gap-1">
              <Badge variant="secondary" className="text-center">
                {opportunity.confidenceLevel}/5
              </Badge>
              {opportunity.forecastCategory && (
                <Badge
                  variant={opportunity.forecastCategory === "commit" ? "default" : "outline"}
                  className="text-center text-[10px] flex items-center gap-0.5"
                >
                  {opportunity.forecastCategory === "commit" && (
                    <CheckCircle className="h-2.5 w-2.5" />
                  )}
                  {FORECAST_LABELS[opportunity.forecastCategory]}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400" suppressHydrationWarning>
              {formatCurrencyCompact(opportunity.amountArr)}
            </span>
            <span className="text-xs text-muted-foreground">ARR</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
            <CalendarDays size={14} className="shrink-0" />
            <span className="text-xs whitespace-nowrap" suppressHydrationWarning>{closeDate}</span>
            {opportunity.riskNotes && (
              <AlertTriangle size={14} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
            )}
          </div>
        </div>

        {opportunity.nextCallDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <CalendarClock className="h-3 w-3 shrink-0" />
            <span className="truncate" suppressHydrationWarning>Next call: {formatDateShort(opportunity.nextCallDate)}</span>
            {opportunity.nextCallDateSource === 'auto_calendar' && (
              <Badge variant="outline" className="h-4 text-[10px] px-1 shrink-0">Auto</Badge>
            )}
          </div>
        )}

        {/* CBC (Contact Before Call) indicator */}
        {cbcStatus.needsNextCall && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 min-w-0">
                  <CalendarPlus className="h-3 w-3 shrink-0" />
                  <span className="truncate font-medium">Schedule next call</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>No upcoming meeting scheduled. Consider booking the next call.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {cbcStatus.date && !cbcStatus.needsNextCall && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-2 text-xs min-w-0 ${
                  cbcStatus.isOverdue
                    ? "text-red-600 dark:text-red-400"
                    : cbcStatus.isDue
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                }`}>
                  <Mail className={`h-3 w-3 shrink-0 ${cbcStatus.isDue ? "animate-pulse" : ""}`} />
                  <span className="truncate" suppressHydrationWarning>
                    {cbcStatus.isOverdue
                      ? `Outreach overdue (${Math.abs(cbcStatus.daysUntil!)}d ago)`
                      : cbcStatus.isDue
                        ? "Reach out today"
                        : `Reach out: ${formatDateShort(cbcStatus.date)}`
                    }
                  </span>
                  {(cbcStatus.isDue || cbcStatus.isOverdue) && (
                    <Badge
                      variant={cbcStatus.isOverdue ? "destructive" : "secondary"}
                      className="h-4 text-[10px] px-1 shrink-0"
                    >
                      {cbcStatus.isOverdue ? "Overdue" : "Due"}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Contact Before Call - optimal time to reach out between meetings.
                  {cbcStatus.daysUntil !== null && cbcStatus.daysUntil > 0 &&
                    ` ${cbcStatus.daysUntil} days until due.`
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {opportunity.nextStep && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <ArrowRight size={14} className="mt-0.5 shrink-0" />
            <p className="text-xs line-clamp-2 leading-relaxed">
              {opportunity.nextStep.split('\n').filter(Boolean).slice(0, 2).join(' • ')}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 min-w-0">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground truncate">
                  {opportunity.owner.name}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{opportunity.owner.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

export default OpportunityCard;


