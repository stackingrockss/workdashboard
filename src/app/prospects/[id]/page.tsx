import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProspectDetailClient } from "@/components/features/prospects/prospect-detail-client";
import { getCurrentUser } from "@/lib/auth";

interface ProspectPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function ProspectDetailPage({ params }: ProspectPageProps) {
  const { id } = await params;

  // Get current user to scope by organization
  const user = await getCurrentUser();
  if (!user || !user.organization) return notFound();

  const accountFromDB = await prisma.account.findFirst({
    where: {
      id,
      organizationId: user.organization.id, // Security: scope to user's organization
    },
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

  return <ProspectDetailClient account={account} organizationId={user.organization.id} />;
}
