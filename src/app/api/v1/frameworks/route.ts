import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  frameworkCreateSchema,
  frameworkListQuerySchema,
} from "@/lib/validations/framework";

// GET /api/v1/frameworks - List frameworks (company + personal based on user)
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = req.nextUrl.searchParams;

    // Parse query parameters
    const queryParsed = frameworkListQuerySchema.safeParse({
      scope: searchParams.get("scope"),
      category: searchParams.get("category"),
      search: searchParams.get("search"),
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
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
      // Company frameworks: visible to everyone in the org
      whereConditions.push({
        organizationId: user.organization.id,
        scope: "company",
      });
    }

    if (scope === "personal" || scope === "all") {
      // Personal frameworks: only the creator can see them
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

    // Fetch frameworks with pagination
    const [total, frameworks] = await Promise.all([
      prisma.contentFramework.count({ where: whereClause }),
      prisma.contentFramework.findMany({
        where: whereClause,
        orderBy: [
          { isDefault: "desc" }, // Default frameworks first
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
      frameworks,
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
    console.error("Error fetching frameworks:", error);
    return NextResponse.json(
      { error: "Failed to fetch frameworks" },
      { status: 500 }
    );
  }
}

// POST /api/v1/frameworks - Create a new framework
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = frameworkCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if user can create company frameworks (admin only)
    if (data.scope === "company" && !isAdmin(user)) {
      return NextResponse.json(
        { error: "Only admins can create company-wide frameworks" },
        { status: 403 }
      );
    }

    // Check for duplicate name within scope
    const existing = await prisma.contentFramework.findFirst({
      where: {
        organizationId: user.organization.id,
        name: data.name,
        scope: data.scope,
        ...(data.scope === "personal" ? { createdById: user.id } : {}),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A ${data.scope} framework with this name already exists` },
        { status: 409 }
      );
    }

    const framework = await prisma.contentFramework.create({
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

    return NextResponse.json({ framework }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating framework:", error);
    return NextResponse.json(
      { error: "Failed to create framework" },
      { status: 500 }
    );
  }
}
