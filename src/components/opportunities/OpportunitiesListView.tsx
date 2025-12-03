"use client";

import { type Opportunity } from "@/types/opportunity";
import { type SerializedKanbanView } from "@/types/view";
import { CurrentQuarterView } from "./CurrentQuarterView";
import { QuarterlyListView } from "./QuarterlyListView";
import { Card } from "@/components/ui/card";
import { Table } from "lucide-react";

interface OpportunitiesListViewProps {
  opportunities: Opportunity[];
  fiscalYearStartMonth: number;
  activeView: SerializedKanbanView;
  onOpportunityUpdate: (id: string, updates: Partial<Opportunity>) => Promise<void>;
}

/**
 * Dynamic list view wrapper that renders the appropriate list based on the active view
 */
export function OpportunitiesListView({
  opportunities,
  fiscalYearStartMonth,
  activeView,
  onOpportunityUpdate,
}: OpportunitiesListViewProps) {
  // Render the appropriate list view based on the active view type
  switch (activeView.viewType) {
    case "currentQuarter":
      return (
        <CurrentQuarterView
          opportunities={opportunities}
          fiscalYearStartMonth={fiscalYearStartMonth}
          onOpportunityUpdate={onOpportunityUpdate}
        />
      );

    case "quarterly":
      return (
        <QuarterlyListView
          opportunities={opportunities}
          fiscalYearStartMonth={fiscalYearStartMonth}
          onOpportunityUpdate={onOpportunityUpdate}
        />
      );

    // For other view types, show a placeholder message
    default:
      return (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
            <Table className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">
              List view is available for Quarterly and Current Quarter views
            </p>
            <p className="text-sm">
              Select &quot;Quarterly View&quot; or &quot;Current Quarter&quot; from the dropdown to see the list view.
            </p>
          </div>
        </Card>
      );
  }
}
