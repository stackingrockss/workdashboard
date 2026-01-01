import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BriefsPageClient } from "@/components/features/briefs/briefs-page-client";
import { Loader2, FileText } from "lucide-react";
import { getTemplateBriefs } from "@/lib/briefs/template-briefs";

export const dynamic = "force-dynamic";

/**
 * Briefs Management Page
 *
 * Lists all available briefs (personal and company)
 * with options to create, edit, and delete briefs.
 */
export default async function BriefsPage() {
  const user = await requireAuth();

  // Fetch briefs - both personal and company-wide
  const dbBriefs = await prisma.contentBrief.findMany({
    where: {
      OR: [
        { scope: "personal", createdById: user.id },
        { scope: "company", organizationId: user.organization.id },
      ],
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      _count: {
        select: {
          generatedContents: true,
        },
      },
    },
    orderBy: [{ scope: "asc" }, { name: "asc" }],
  });

  // Get template briefs from code
  const templateBriefs = getTemplateBriefs();

  // Combine template briefs with database briefs
  const allBriefs = [
    ...templateBriefs.map((b) => ({
      ...b,
      _count: { generatedContents: 0 },
    })),
    ...dbBriefs,
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Briefs</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage AI content generation templates
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <BriefsPageClient
          briefs={allBriefs.map(b => ({
            id: b.id,
            name: b.name,
            description: b.description ?? null,
            category: b.category,
            scope: b.scope,
            systemInstruction: b.systemInstruction,
            outputFormat: b.outputFormat ?? null,
            createdById: b.createdById,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
            usageCount: b._count.generatedContents,
            isDefault: b.isDefault ?? false,
            createdBy: b.createdBy ?? null,
          }))}
          currentUserId={user.id}
        />
      </Suspense>
    </div>
  );
}
