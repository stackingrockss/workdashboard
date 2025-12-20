import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CreateFrameworkPage } from "@/components/features/frameworks/create-framework-page";

export const dynamic = "force-dynamic";

interface EditFrameworkPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit Framework Page
 */
export default async function EditFrameworkPage({ params }: EditFrameworkPageProps) {
  const user = await requireAuth();
  const { id } = await params;

  // Fetch the framework
  const framework = await prisma.contentFramework.findFirst({
    where: {
      id,
      OR: [
        { scope: "personal", createdById: user.id },
        { scope: "company", organizationId: user.organization.id },
      ],
    },
  });

  if (!framework) {
    notFound();
  }

  return (
    <CreateFrameworkPage
      editFramework={{
        id: framework.id,
        name: framework.name,
        description: framework.description,
        category: framework.category,
        scope: framework.scope,
        systemInstruction: framework.systemInstruction,
        outputFormat: framework.outputFormat,
        sections: framework.sections as { title: string; description?: string; required?: boolean }[],
        contextConfig: framework.contextConfig as { meetings?: boolean; files?: boolean; notes?: boolean; accountResearch?: boolean } | null,
        createdById: framework.createdById,
        organizationId: framework.organizationId,
        isDefault: framework.isDefault,
        usageCount: framework.usageCount,
        createdAt: framework.createdAt,
        updatedAt: framework.updatedAt,
      }}
    />
  );
}
