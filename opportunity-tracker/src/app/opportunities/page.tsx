// app/opportunities/page.tsx
// Displays a Kanban view of opportunities using mock data

import KanbanBoard from "@/components/kanban/KanbanBoard";
import { mockOpportunities } from "@/data/mock-opportunities";

export const dynamic = "force-static";

export default async function OpportunitiesPage() {
  // In a future iteration, fetch opportunities from DB/API here
  const opportunities = mockOpportunities;
  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Track deals, next steps, and forecast in a Kanban view
        </p>
      </div>
      <KanbanBoard opportunities={opportunities} />
    </div>
  );
}


