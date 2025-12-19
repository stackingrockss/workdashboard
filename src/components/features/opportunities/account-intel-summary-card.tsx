"use client";

import { CheckCircle2, Circle, FileText, Building2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AccountIntelSummaryCardProps {
  hasAccountResearch: boolean;
  hasSecFilings: boolean;
  hasEarningsTranscripts: boolean;
  onScrollToSection: (sectionId: string) => void;
}

interface StatusItemProps {
  label: string;
  isComplete: boolean;
  icon: React.ReactNode;
  sectionId: string;
  onScrollTo: (id: string) => void;
}

function StatusItem({ label, isComplete, icon, sectionId, onScrollTo }: StatusItemProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "flex items-center gap-2 h-auto py-2 px-3 hover:bg-muted/50",
        isComplete ? "text-foreground" : "text-muted-foreground"
      )}
      onClick={() => onScrollTo(sectionId)}
    >
      {isComplete ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
      ) : (
        <Circle className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Button>
  );
}

export function AccountIntelSummaryCard({
  hasAccountResearch,
  hasSecFilings,
  hasEarningsTranscripts,
  onScrollToSection,
}: AccountIntelSummaryCardProps) {
  const sections = [
    {
      label: "Research",
      isComplete: hasAccountResearch,
      icon: <FileText className="h-4 w-4" />,
      sectionId: "account-research",
    },
    {
      label: "SEC Filings",
      isComplete: hasSecFilings,
      icon: <Building2 className="h-4 w-4" />,
      sectionId: "sec-filings",
    },
    {
      label: "Earnings",
      isComplete: hasEarningsTranscripts,
      icon: <TrendingUp className="h-4 w-4" />,
      sectionId: "earnings-transcripts",
    },
  ];

  const completedCount = sections.filter((s) => s.isComplete).length;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {sections.map((section) => (
              <StatusItem
                key={section.sectionId}
                label={section.label}
                isComplete={section.isComplete}
                icon={section.icon}
                sectionId={section.sectionId}
                onScrollTo={onScrollToSection}
              />
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            {completedCount}/{sections.length} complete
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
