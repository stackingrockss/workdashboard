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
      granolaNotes: {
        orderBy: { createdAt: "desc" },
      },
      gongCalls: {
        orderBy: { createdAt: "desc" },
      },
      googleNotes: {
        orderBy: { createdAt: "desc" },
      },
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
    confidenceLevel: opportunityFromDB.confidenceLevel,
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
    granolaNotes: opportunityFromDB.granolaNotes.map(note => ({
      id: note.id,
      opportunityId: note.opportunityId,
      title: note.title,
      url: note.url,
      meetingDate: note.meetingDate.toISOString(),
      noteType: note.noteType as "customer" | "internal" | "prospect",
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    gongCalls: opportunityFromDB.gongCalls.map(call => ({
      id: call.id,
      opportunityId: call.opportunityId,
      title: call.title,
      url: call.url,
      meetingDate: call.meetingDate.toISOString(),
      noteType: call.noteType as "customer" | "internal" | "prospect",
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString(),
    })),
    googleNotes: opportunityFromDB.googleNotes.map(note => ({
      id: note.id,
      opportunityId: note.opportunityId,
      title: note.title,
      url: note.url,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    createdAt: opportunityFromDB.createdAt.toISOString(),
    updatedAt: opportunityFromDB.updatedAt.toISOString(),
  };

  return <OpportunityDetailClient opportunity={opportunity} />;
}


