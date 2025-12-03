import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { contentCreateSchema } from "@/lib/validations/content";
import { ContentType } from "@prisma/client";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

const VALID_CONTENT_TYPES: ContentType[] = [
  "blog_post",
  "case_study",
  "whitepaper",
  "video",
  "webinar",
  "business_case",
  "other",
];

// GET /api/v1/content - List all content for organization
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    const searchParams = req.nextUrl.searchParams;
    const typeParam = searchParams.get("type");
    const contentType = typeParam && VALID_CONTENT_TYPES.includes(typeParam as ContentType)
      ? (typeParam as ContentType)
      : undefined;

    // Build where clause
    const whereClause = {
      organizationId: user.organization.id,
      ...(contentType && { contentType }),
    };

    // Define include for content relations
    const includeRelations = {
      createdBy: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    };

    // Detect if client wants pagination
    const usePagination = wantsPagination(searchParams);

    if (usePagination) {
      // PAGINATED MODE: Client requested pagination via query params
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 50, // Default to 50
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 50; // Ensure limit is never undefined
      const skip = (page - 1) * limit;

      // Parallel queries for performance (count total + fetch page)
      const [total, contents] = await Promise.all([
        prisma.content.count({ where: whereClause }),
        prisma.content.findMany({
          where: whereClause,
          include: includeRelations,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      return cachedResponse(
        buildPaginatedResponse(contents, page, limit, total, 'contents'),
        'frequent'
      );
    } else {
      // LEGACY MODE: No pagination params, return all content
      const contents = await prisma.content.findMany({
        where: whereClause,
        include: includeRelations,
        orderBy: { createdAt: "desc" },
      });

      return cachedResponse(
        buildLegacyResponse(contents, 'contents'),
        'frequent'
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/v1/content] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}

// POST /api/v1/content - Create new content
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = contentCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Check for duplicate URL in organization
    const existingContent = await prisma.content.findUnique({
      where: {
        organizationId_url: {
          organizationId: user.organization.id,
          url: parsed.data.url,
        },
      },
    });

    if (existingContent) {
      return NextResponse.json(
        { error: "Content with this URL already exists" },
        { status: 409 }
      );
    }

    const content = await prisma.content.create({
      data: {
        title: parsed.data.title,
        url: parsed.data.url,
        description: parsed.data.description,
        body: parsed.data.body,
        contentType: parsed.data.contentType,
        createdById: user.id,
        organizationId: user.organization.id,
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

    revalidatePath("/content");

    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/v1/content] Error:", error);
    return NextResponse.json(
      { error: "Failed to create content" },
      { status: 500 }
    );
  }
}
