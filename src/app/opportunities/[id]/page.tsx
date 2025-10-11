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
    include: { owner: true },
  });

  if (!opportunityFromDB) return notFound();

  const opportunity = {
    id: opportunityFromDB.id,
    name: opportunityFromDB.name,
    account: opportunityFromDB.account,
    amountArr: opportunityFromDB.amountArr,
    probability: opportunityFromDB.probability,
    nextStep: opportunityFromDB.nextStep || undefined,
    closeDate: opportunityFromDB.closeDate?.toISOString() || undefined,
    stage: opportunityFromDB.stage,
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


