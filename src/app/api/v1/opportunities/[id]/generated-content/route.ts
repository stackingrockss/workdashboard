import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { generatedContentListQuerySchema } from "@/lib/validations/framework";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/opportunities/[id]/generated-content - List all generated content for an opportunity
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;
    const searchParams = req.nextUrl.searchParams;

    // Verify opportunity exists and user has access
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Parse query parameters
    const queryParsed = generatedContentListQuerySchema.safeParse({
      frameworkId: searchParams.get("frameworkId"),
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    if (!queryParsed.success) {
      return NextResponse.json(
        { error: queryParsed.error.flatten() },
        { status: 400 }
      );
    }

    const { frameworkId, page, limit } = queryParsed.data;
    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      opportunityId,
      organizationId: user.organization.id,
      // Only show latest version of each framework for this opportunity
      parentVersionId: null,
    };

    if (frameworkId) {
      whereClause.frameworkId = frameworkId;
    }

    // Fetch generated content with pagination
    const [total, generatedContents] = await Promise.all([
      prisma.generatedContent.count({ where: whereClause }),
      prisma.generatedContent.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
          framework: {
            select: {
              id: true,
              name: true,
              category: true,
              description: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          // Include count of child versions
          _count: {
            select: { childVersions: true },
          },
        },
        skip,
        take: limit,
      }),
    ]);

    // Transform to include version count
    const transformedContents = generatedContents.map((content) => ({
      ...content,
      totalVersions: content._count.childVersions + 1,
      _count: undefined,
    }));

    return NextResponse.json({
      generatedContents: transformedContents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching generated content:", error);
    return NextResponse.json(
      { error: "Failed to fetch generated content" },
      { status: 500 }
    );
  }
}
