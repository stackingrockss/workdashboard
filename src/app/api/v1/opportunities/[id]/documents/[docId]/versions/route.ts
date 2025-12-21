import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { documentRestoreVersionSchema } from "@/lib/validations/document";

interface RouteParams {
  params: Promise<{ id: string; docId: string }>;
}

// GET /api/v1/opportunities/[id]/documents/[docId]/versions - Get version history
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, docId } = await params;

    // Verify document exists and user has access
    const document = await prisma.document.findFirst({
      where: {
        id: docId,
        opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Find the root of the version chain
    let rootDocumentId = document.id;
    let currentDoc = document;

    while (currentDoc.parentVersionId) {
      const parent = await prisma.document.findUnique({
        where: { id: currentDoc.parentVersionId },
      });
      if (parent) {
        rootDocumentId = parent.id;
        currentDoc = parent;
      } else {
        break;
      }
    }

    // Get all versions in the chain
    const versions = await getVersionChain(rootDocumentId);

    return NextResponse.json({ versions });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

// Helper function to get all versions in a chain
async function getVersionChain(rootId: string) {
  const versions: Array<{
    id: string;
    version: number;
    createdAt: Date;
    generationStatus: string | null;
    createdBy?: { id: string; name: string | null };
  }> = [];

  // Get root
  const root = await prisma.document.findUnique({
    where: { id: rootId },
    select: {
      id: true,
      version: true,
      createdAt: true,
      generationStatus: true,
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (root) {
    versions.push(root);
  }

  // Recursively get children
  async function getChildren(parentId: string) {
    const children = await prisma.document.findMany({
      where: { parentVersionId: parentId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        createdAt: true,
        generationStatus: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    for (const child of children) {
      versions.push(child);
      await getChildren(child.id);
    }
  }

  await getChildren(rootId);

  // Sort by version descending
  versions.sort((a, b) => b.version - a.version);

  return versions;
}

// POST /api/v1/opportunities/[id]/documents/[docId]/versions - Restore a previous version
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, docId } = await params;

    // Verify current document exists and user has access
    const currentDocument = await prisma.document.findFirst({
      where: {
        id: docId,
        opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!currentDocument) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const json = await req.json();
    const parsed = documentRestoreVersionSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { versionId } = parsed.data;

    // Verify the version exists and belongs to the same document chain
    const versionToRestore = await prisma.document.findFirst({
      where: {
        id: versionId,
        opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!versionToRestore) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    // Helper to handle null JSON values
    const jsonOrNull = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull => {
      return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
    };

    // Create a new version with the restored content
    const restoredDocument = await prisma.document.create({
      data: {
        opportunityId: currentDocument.opportunityId,
        organizationId: currentDocument.organizationId,
        title: versionToRestore.title,
        category: currentDocument.category,
        content: versionToRestore.content,
        structuredData: jsonOrNull(versionToRestore.structuredData),
        briefId: currentDocument.briefId,
        generationStatus: "completed",
        contextSnapshot: jsonOrNull(versionToRestore.contextSnapshot),
        version: currentDocument.version + 1,
        parentVersionId: currentDocument.id,
        createdById: user.id,
        generatedAt: new Date(),
      },
      include: {
        brief: {
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

    return NextResponse.json({ document: restoredDocument }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error restoring version:", error);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  }
}
