"use client";

// Reusable component for displaying parsed insights (pain points, goals, next steps)
// Used in both the detail panel and the summary card

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Target,
  ListChecks,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InsightsDisplayProps {
  painPoints: string[];
  goals: string[];
  nextSteps: string[];
  showEmpty?: boolean;
  compact?: boolean;
  showCopyButtons?: boolean;
}

interface InsightSectionProps {
  title: string;
  items: string[];
  icon: React.ReactNode;
  colorClass: string;
  showCopy?: boolean;
  compact?: boolean;
}

function InsightSection({
  title,
  items,
  icon,
  colorClass,
  showCopy,
  compact,
}: InsightSectionProps) {
  const [copied, setCopied] = useState(false);

  if (items.length === 0) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(items.join("\n"));
      setCopied(true);
      toast.success(`${title} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className={cn("space-y-1.5", compact ? "space-y-1" : "space-y-1.5")}>
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-2 font-medium",
            colorClass,
            compact ? "text-xs" : "text-sm"
          )}
        >
          {icon}
          {title}
        </div>
        {showCopy && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">Copy {title}</span>
          </Button>
        )}
      </div>
      <ul
        className={cn(
          "list-disc list-inside text-muted-foreground ml-1",
          compact ? "text-xs space-y-0" : "text-sm space-y-0.5"
        )}
      >
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function InsightsDisplay({
  painPoints,
  goals,
  nextSteps,
  showEmpty = false,
  compact = false,
  showCopyButtons = false,
}: InsightsDisplayProps) {
  const hasAnyInsights =
    painPoints.length > 0 || goals.length > 0 || nextSteps.length > 0;

  if (!hasAnyInsights) {
    if (showEmpty) {
      return (
        <p className="text-sm text-muted-foreground italic">
          No insights extracted yet.
        </p>
      );
    }
    return null;
  }

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3")}>
      <InsightSection
        title="Pain Points"
        items={painPoints}
        icon={<AlertTriangle className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
        colorClass="text-orange-600 dark:text-orange-400"
        showCopy={showCopyButtons}
        compact={compact}
      />

      <InsightSection
        title="Goals"
        items={goals}
        icon={<Target className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
        colorClass="text-blue-600 dark:text-blue-400"
        showCopy={showCopyButtons}
        compact={compact}
      />

      <InsightSection
        title="Next Steps"
        items={nextSteps}
        icon={<ListChecks className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
        colorClass="text-green-600 dark:text-green-400"
        showCopy={showCopyButtons}
        compact={compact}
      />
    </div>
  );
}
