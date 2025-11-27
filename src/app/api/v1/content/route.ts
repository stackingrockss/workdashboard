import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { contentCreateSchema } from "@/lib/validations/content";
import { ContentType } from "@prisma/client";

const VALID_CONTENT_TYPES: ContentType[] = [
  "blog_post",
  "case_study",
  "whitepaper",
  "video",
  "webinar",
  "other",
];

// GET /api/v1/content - List all content for organization
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get("type");
    const contentType = typeParam && VALID_CONTENT_TYPES.includes(typeParam as ContentType)
      ? (typeParam as ContentType)
      : undefined;

    const contents = await prisma.content.findMany({
      where: {
        organizationId: user.organization.id,
        ...(contentType && { contentType }),
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contents });
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
