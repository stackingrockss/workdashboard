// app/opportunities/[id]/page.tsx
// Server component: displays a single opportunity from the database

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OpportunityDetailClient } from "@/components/features/opportunities/opportunity-detail-client";

interface OpportunityPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }: OpportunityPageProps) {
  const { id } = await params;

  const opportunityFromDB = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      owner: true,
      account: true,
    },
  });

  if (!opportunityFromDB) return notFound();

  const opportunity = {
    id: opportunityFromDB.id,
    name: opportunityFromDB.name,
    accountId: opportunityFromDB.accountId || undefined,
    accountName: opportunityFromDB.accountName || undefined,
    account: opportunityFromDB.account ? {
      id: opportunityFromDB.account.id,
      name: opportunityFromDB.account.name,
    } : undefined,
    amountArr: opportunityFromDB.amountArr,
    probability: opportunityFromDB.probability,
    nextStep: opportunityFromDB.nextStep || undefined,
    closeDate: opportunityFromDB.closeDate?.toISOString() || undefined,
    quarter: opportunityFromDB.quarter || undefined,
    stage: opportunityFromDB.stage,
    forecastCategory: opportunityFromDB.forecastCategory || undefined,
    riskNotes: opportunityFromDB.riskNotes || undefined,
    notes: opportunityFromDB.notes || undefined,
    owner: {
      id: opportunityFromDB.owner.id,
      name: opportunityFromDB.owner.name,
      avatarUrl: opportunityFromDB.owner.avatarUrl || undefined,
    },
    createdAt: opportunityFromDB.createdAt.toISOString(),
    updatedAt: opportunityFromDB.updatedAt.toISOString(),
  };

  return <OpportunityDetailClient opportunity={opportunity} />;
}


