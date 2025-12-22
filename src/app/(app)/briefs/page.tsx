import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BriefsPageClient } from "@/components/features/briefs/briefs-page-client";
import { Loader2, FileText } from "lucide-react";

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
  const briefs = await prisma.contentBrief.findMany({
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
          briefs={briefs.map(b => ({
            ...b,
            usageCount: b._count.generatedContents,
          }))}
          currentUserId={user.id}
        />
      </Suspense>
    </div>
  );
}
