import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CreateBriefPage } from "@/components/features/briefs/create-brief-page";

export const dynamic = "force-dynamic";

interface EditBriefPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit Brief Page
 */
export default async function EditBriefPage({ params }: EditBriefPageProps) {
  const user = await requireAuth();
  const { id } = await params;

  // Fetch the brief
  const brief = await prisma.contentBrief.findFirst({
    where: {
      id,
      OR: [
        { scope: "personal", createdById: user.id },
        { scope: "company", organizationId: user.organization.id },
      ],
    },
  });

  if (!brief) {
    notFound();
  }

  return (
    <CreateBriefPage
      editBrief={{
        id: brief.id,
        name: brief.name,
        description: brief.description,
        category: brief.category,
        scope: brief.scope,
        systemInstruction: brief.systemInstruction,
        outputFormat: brief.outputFormat,
        sections: brief.sections as { title: string; description?: string; required?: boolean }[],
        contextConfig: brief.contextConfig as { meetings?: boolean; files?: boolean; notes?: boolean; accountResearch?: boolean } | null,
        createdById: brief.createdById,
        organizationId: brief.organizationId,
        isDefault: brief.isDefault,
        usageCount: brief.usageCount,
        createdAt: brief.createdAt,
        updatedAt: brief.updatedAt,
      }}
    />
  );
}
