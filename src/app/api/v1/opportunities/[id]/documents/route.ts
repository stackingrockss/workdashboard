import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  documentCreateSchema,
  documentListQuerySchema,
} from "@/lib/validations/document";
import { inngest } from "@/lib/inngest/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/opportunities/[id]/documents - List all documents for an opportunity
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
    const queryParsed = documentListQuerySchema.safeParse({
      documentType: searchParams.get("documentType"),
      frameworkId: searchParams.get("frameworkId"),
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

    const { documentType, frameworkId, search, page, limit } = queryParsed.data;
    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      opportunityId,
      organizationId: user.organization.id,
      // Only show latest version of each document
      parentVersionId: null,
    };

    if (documentType) {
      whereClause.documentType = documentType;
    }

    if (frameworkId) {
      whereClause.frameworkId = frameworkId;
    }

    if (search) {
      whereClause.title = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Fetch documents with pagination
    const [total, documents] = await Promise.all([
      prisma.document.count({ where: whereClause }),
      prisma.document.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        include: {
          framework: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          lastEditedBy: {
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
    const transformedDocuments = documents.map((doc) => ({
      ...doc,
      totalVersions: doc._count.childVersions + 1,
      _count: undefined,
    }));

    return NextResponse.json({
      documents: transformedDocuments,
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
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST /api/v1/opportunities/[id]/documents - Create a new document
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

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

    const json = await req.json();
    const parsed = documentCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      title,
      documentType,
      content,
      structuredData,
      frameworkId,
      contextSelection,
      generateFromMeetings,
      templateContentId,
    } = parsed.data;

    // If framework-generated, verify framework exists and user has access
    let framework = null;
    if (frameworkId) {
      framework = await prisma.contentFramework.findFirst({
        where: {
          id: frameworkId,
          organizationId: user.organization.id,
          OR: [
            { scope: "company" },
            { scope: "personal", createdById: user.id },
          ],
        },
      });

      if (!framework) {
        return NextResponse.json(
          { error: "Framework not found" },
          { status: 404 }
        );
      }
    }

    // Determine if we need AI generation
    const needsGeneration =
      (documentType === "framework_generated" && frameworkId) ||
      (documentType === "mutual_action_plan" && generateFromMeetings);

    // Prepare structured data
    const structuredDataValue = structuredData
      ? structuredData
      : documentType === "mutual_action_plan" && !generateFromMeetings
        ? { actionItems: [] }
        : Prisma.JsonNull;

    // Prepare context snapshot
    const contextSnapshotValue = contextSelection ? contextSelection : Prisma.JsonNull;

    // Create the document
    const document = await prisma.document.create({
      data: {
        opportunityId: opportunity.id,
        organizationId: user.organization.id,
        title: title || (framework ? `${framework.name} - ${opportunity.name}` : "Untitled Document"),
        documentType,
        content: content || (needsGeneration ? "" : null),
        structuredData: structuredDataValue,
        frameworkId: frameworkId || null,
        generationStatus: needsGeneration ? "pending" : null,
        contextSnapshot: contextSnapshotValue,
        version: 1,
        createdById: user.id,
      },
      include: {
        framework: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Trigger background job for AI generation if needed
    if (needsGeneration) {
      if (documentType === "framework_generated" && frameworkId) {
        // Use existing framework generation
        await inngest.send({
          name: "document/generate-content",
          data: {
            documentId: document.id,
            opportunityId: opportunity.id,
            frameworkId: frameworkId,
            contextSelection: contextSelection || {},
            userId: user.id,
            organizationId: user.organization.id,
          },
        });
      } else if (documentType === "mutual_action_plan" && generateFromMeetings) {
        // Use MAP generation
        await inngest.send({
          name: "document/generate-map",
          data: {
            documentId: document.id,
            opportunityId: opportunity.id,
            templateContentId: templateContentId || null,
            userId: user.id,
            organizationId: user.organization.id,
          },
        });
      }
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating document:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}
