import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  briefCreateSchema,
  briefListQuerySchema,
} from "@/lib/validations/brief";

// GET /api/v1/briefs - List briefs (company + personal based on user)
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = req.nextUrl.searchParams;

    // Parse query parameters (convert empty strings to undefined for optional fields)
    const queryParsed = briefListQuerySchema.safeParse({
      scope: searchParams.get("scope") || undefined,
      category: searchParams.get("category") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    if (!queryParsed.success) {
      return NextResponse.json(
        { error: queryParsed.error.flatten() },
        { status: 400 }
      );
    }

    const { scope, category, search, page, limit } = queryParsed.data;
    const skip = (page - 1) * limit;

    // Build where clause based on scope
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereConditions: any[] = [];

    if (scope === "company" || scope === "all") {
      // Company briefs: visible to everyone in the org
      whereConditions.push({
        organizationId: user.organization.id,
        scope: "company",
      });
    }

    if (scope === "personal" || scope === "all") {
      // Personal briefs: only the creator can see them
      whereConditions.push({
        organizationId: user.organization.id,
        scope: "personal",
        createdById: user.id,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      OR: whereConditions,
    };

    // Add category filter if provided
    if (category) {
      whereClause.category = category;
    }

    // Add search filter if provided
    if (search) {
      whereClause.AND = [
        {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    // Fetch briefs with pagination
    const [total, briefs] = await Promise.all([
      prisma.contentBrief.count({ where: whereClause }),
      prisma.contentBrief.findMany({
        where: whereClause,
        orderBy: [
          { isDefault: "desc" }, // Default briefs first
          { usageCount: "desc" }, // Then by usage
          { name: "asc" }, // Then alphabetically
        ],
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      briefs,
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
    console.error("Error fetching briefs:", error);
    return NextResponse.json(
      { error: "Failed to fetch briefs" },
      { status: 500 }
    );
  }
}

// POST /api/v1/briefs - Create a new brief
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = briefCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if user can create company briefs (admin only)
    if (data.scope === "company" && !isAdmin(user)) {
      return NextResponse.json(
        { error: "Only admins can create company-wide briefs" },
        { status: 403 }
      );
    }

    // Check for duplicate name within scope
    const existing = await prisma.contentBrief.findFirst({
      where: {
        organizationId: user.organization.id,
        name: data.name,
        scope: data.scope,
        ...(data.scope === "personal" ? { createdById: user.id } : {}),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A ${data.scope} brief with this name already exists` },
        { status: 409 }
      );
    }

    const brief = await prisma.contentBrief.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        scope: data.scope,
        systemInstruction: data.systemInstruction,
        outputFormat: data.outputFormat,
        sections: data.sections,
        contextConfig: data.contextConfig,
        createdById: user.id,
        organizationId: user.organization.id,
        isDefault: false,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ brief }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating brief:", error);
    return NextResponse.json(
      { error: "Failed to create brief" },
      { status: 500 }
    );
  }
}
