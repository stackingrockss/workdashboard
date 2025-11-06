import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WhiteboardTable } from "@/components/whiteboard/WhiteboardTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function WhiteboardingPage() {
  const user = await requireAuth();

  // Fetch opportunities for the authenticated user
  const opportunities = await prisma.opportunity.findMany({
    where: { ownerId: user.id },
    include: {
      owner: true,
      account: true,
    },
    orderBy: { closeDate: "asc" },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Whiteboarding</h1>
          <p className="text-muted-foreground mt-1">
            Spreadsheet-style view of all your opportunities with inline editing
          </p>
        </div>
        <Button asChild>
          <Link href="/opportunities">
            <Plus className="h-4 w-4 mr-2" />
            New Opportunity
          </Link>
        </Button>
      </div>

      {opportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-lg">
          <h3 className="text-lg font-medium mb-2">No opportunities yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get started by creating your first opportunity
          </p>
          <Button asChild>
            <Link href="/opportunities">
              <Plus className="h-4 w-4 mr-2" />
              Create Opportunity
            </Link>
          </Button>
        </div>
      ) : (
        <WhiteboardTable opportunities={opportunities} />
      )}
    </div>
  );
}
