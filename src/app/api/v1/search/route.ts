import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getVisibleUserIds, isAdmin } from "@/lib/permissions";
import { z } from "zod";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(20).default(5),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = req.nextUrl.searchParams;

    const parsed = searchQuerySchema.safeParse({
      q: searchParams.get("q"),
      limit: searchParams.get("limit"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search query" },
        { status: 400 }
      );
    }

    const { q, limit } = parsed.data;
    const searchTerm = q.toLowerCase();

    // Get visible user IDs based on role and direct reports
    const visibleUserIds = getVisibleUserIds(user, user.directReports);

    // Build where clause based on visibility
    const opportunityWhereClause = isAdmin(user)
      ? { organizationId: user.organization.id }
      : { ownerId: { in: visibleUserIds } };

    // Search opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: {
        ...opportunityWhereClause,
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { accountName: { contains: searchTerm, mode: "insensitive" } },
          { account: { name: { contains: searchTerm, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        accountName: true,
        amountArr: true,
        stage: true,
        account: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    // Search accounts
    const accounts = await prisma.account.findMany({
      where: {
        organizationId: user.organization.id,
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { industry: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        industry: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    // Map opportunities to include account name from relation if available
    const mappedOpportunities = opportunities.map((opp) => ({
      id: opp.id,
      name: opp.name,
      accountName: opp.account?.name ?? opp.accountName ?? undefined,
      amountArr: opp.amountArr,
      stage: opp.stage,
    }));

    return NextResponse.json({
      opportunities: mappedOpportunities,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        industry: acc.industry ?? undefined,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
