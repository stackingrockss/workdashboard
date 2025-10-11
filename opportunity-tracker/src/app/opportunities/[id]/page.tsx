// app/opportunities/[id]/page.tsx
// Server component: displays a single opportunity from mock data for now

import { notFound } from "next/navigation";
import { mockOpportunities } from "@/data/mock-opportunities";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";

interface OpportunityPageProps {
  params: Promise<{ id: string }>;
}

export default async function OpportunityDetailPage({ params }: OpportunityPageProps) {
  const { id } = await params;
  const opportunity = mockOpportunities.find((o) => o.id === id);
  if (!opportunity) return notFound();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{opportunity.name}</h1>
        <p className="text-sm text-muted-foreground">{opportunity.account}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Stage</div>
          <div className="font-medium capitalize">{opportunity.stage}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Amount (ARR)</div>
          <div className="font-medium">{formatCurrencyCompact(opportunity.amountArr)} ARR</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Probability</div>
          <div className="font-medium">{opportunity.probability}%</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Close date</div>
          <div className="font-medium">{formatDateShort(opportunity.closeDate)}</div>
        </div>
        <div className="rounded-lg border p-4 md:col-span-2 lg:col-span-3">
          <div className="text-sm text-muted-foreground">Next step</div>
          <div className="font-medium whitespace-pre-wrap">{opportunity.nextStep ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}


