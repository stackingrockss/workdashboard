import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recalculateNextCallDateForOpportunity } from "@/lib/utils/next-call-date-calculator";

/**
 * POST /api/v1/opportunities/[id]/recalculate-next-call-date
 * Force recalculation of next call date from meetings
 * Always recalculates, even if manually set (external meetings take precedence)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireAuth();

  // Verify opportunity belongs to user's organization
  const opportunity = await prisma.opportunity.findFirst({
    where: { id, organizationId: user.organization.id },
    select: { id: true },
  });

  if (!opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const calculated = await recalculateNextCallDateForOpportunity(id);

    return NextResponse.json({
      nextCallDate: calculated.nextCallDate?.toISOString() || null,
      source: calculated.source,
    });
  } catch (error) {
    console.error(`[POST /api/v1/opportunities/${id}/recalculate-next-call-date] Error:`, error);
    return NextResponse.json(
      { error: "Failed to recalculate next call date" },
      { status: 500 }
    );
  }
}
