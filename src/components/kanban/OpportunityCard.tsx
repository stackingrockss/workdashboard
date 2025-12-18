"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Opportunity } from "@/types/opportunity";
import { CircleDollarSign, CalendarDays, ArrowRight, AlertTriangle, Pin, ExternalLink, CalendarClock } from "lucide-react";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FORECAST_LABELS } from "@/lib/constants";

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

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 active:scale-[0.99]"
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
                  className="text-center text-[10px]"
                >
                  {FORECAST_LABELS[opportunity.forecastCategory]}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CircleDollarSign size={16} />
            <span suppressHydrationWarning>{formatCurrencyCompact(opportunity.amountArr)} ARR</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays size={16} />
              <span suppressHydrationWarning>{closeDate}</span>
            </div>
            {opportunity.riskNotes && (
              <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400" />
            )}
          </div>
        </div>

        {opportunity.nextCallDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            <span suppressHydrationWarning>Next call: {formatDateShort(opportunity.nextCallDate)}</span>
            {opportunity.nextCallDateSource === 'auto_calendar' && (
              <Badge variant="outline" className="h-4 text-[10px] px-1">Auto</Badge>
            )}
          </div>
        )}

        {opportunity.nextStep && (
          <div className="flex items-start gap-2 text-sm">
            <ArrowRight size={16} className="mt-[2px] text-muted-foreground shrink-0" />
            <ul className="space-y-0.5 min-w-0">
              {opportunity.nextStep.split('\n').filter(Boolean).slice(0, 3).map((step, idx) => (
                <li key={idx} className="truncate">• {step}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Avatar className="h-6 w-6">
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


