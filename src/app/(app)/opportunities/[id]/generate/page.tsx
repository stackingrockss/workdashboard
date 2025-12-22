import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuthOrRedirect } from "@/lib/auth";
import { GenerateContentWorkflow } from "@/components/features/opportunities/generate/GenerateContentWorkflow";

interface GenerateContentPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Full-page content generation workflow for an opportunity.
 * Provides an immersive experience for selecting frameworks and context.
 */
export default async function GenerateContentPage({
  params,
}: GenerateContentPageProps) {
  const { id } = await params;

  const user = await requireAuthOrRedirect();

  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id,
      organizationId: user.organization.id,
    },
    select: {
      id: true,
      name: true,
      accountId: true,
      accountName: true,
      accountResearch: true,
      consolidatedPainPoints: true,
      consolidatedGoals: true,
      account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!opportunity) return notFound();

  return (
    <GenerateContentWorkflow
      opportunityId={opportunity.id}
      opportunityName={opportunity.name}
      accountName={opportunity.account?.name || opportunity.accountName || undefined}
      hasAccountResearch={!!opportunity.accountResearch}
      hasConsolidatedInsights={
        !!(opportunity.consolidatedPainPoints || opportunity.consolidatedGoals)
      }
    />
  );
}
