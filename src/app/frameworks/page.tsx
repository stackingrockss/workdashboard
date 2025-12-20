import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FrameworksPageClient } from "@/components/features/frameworks/frameworks-page-client";
import { Loader2, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Frameworks Management Page
 *
 * Lists all available frameworks (personal and company)
 * with options to create, edit, and delete frameworks.
 */
export default async function FrameworksPage() {
  const user = await requireAuth();

  // Fetch frameworks - both personal and company-wide
  const frameworks = await prisma.contentFramework.findMany({
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Layers className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Frameworks</h1>
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
        <FrameworksPageClient
          frameworks={frameworks.map(f => ({
            ...f,
            usageCount: f._count.generatedContents,
          }))}
          currentUserId={user.id}
        />
      </Suspense>
    </div>
  );
}
