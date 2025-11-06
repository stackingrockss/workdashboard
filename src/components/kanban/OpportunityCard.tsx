"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Opportunity } from "@/types/opportunity";
import { CircleDollarSign, CalendarDays, ArrowRight, AlertTriangle, Pin } from "lucide-react";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { useState } from "react";
import { useRouter } from "next/navigation";

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

  const forecastLabels: Record<string, string> = {
    pipeline: "Pipeline",
    bestCase: "Best Case",
    forecast: "Commit",
  };

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
      router.refresh(); // Refresh server components
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    } finally {
      setIsPinning(false);
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onClick?.(opportunity.id)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{opportunity.name}</div>
            <div className="truncate text-muted-foreground text-sm">{accountName}</div>
          </div>
          <div className="flex items-start gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePinToggle}
              disabled={isPinning}
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
                  variant={opportunity.forecastCategory === "forecast" ? "default" : "outline"}
                  className="text-center text-[10px]"
                >
                  {forecastLabels[opportunity.forecastCategory]}
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

        {opportunity.nextStep && (
          <div className="flex items-start gap-2 text-sm">
            <ArrowRight size={16} className="mt-[2px] text-muted-foreground" />
            <span className="line-clamp-2">{opportunity.nextStep}</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {opportunity.owner.name}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default OpportunityCard;


