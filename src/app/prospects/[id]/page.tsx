import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProspectDetailClient } from "@/components/features/prospects/prospect-detail-client";

interface ProspectPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function ProspectDetailPage({ params }: ProspectPageProps) {
  const { id } = await params;

  const accountFromDB = await prisma.account.findUnique({
    where: { id },
    include: {
      opportunities: {
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!accountFromDB) return notFound();

  const account = {
    id: accountFromDB.id,
    name: accountFromDB.name,
    industry: accountFromDB.industry || undefined,
    priority: accountFromDB.priority,
    health: accountFromDB.health,
    notes: accountFromDB.notes || undefined,
    opportunities: accountFromDB.opportunities.map(opp => ({
      id: opp.id,
      name: opp.name,
      amountArr: opp.amountArr,
      stage: opp.stage,
    })),
    createdAt: accountFromDB.createdAt.toISOString(),
    updatedAt: accountFromDB.updatedAt.toISOString(),
  };

  return <ProspectDetailClient account={account} />;
}
