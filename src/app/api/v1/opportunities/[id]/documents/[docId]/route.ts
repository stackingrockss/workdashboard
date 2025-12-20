import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { documentUpdateSchema } from "@/lib/validations/document";

interface RouteParams {
  params: Promise<{ id: string; docId: string }>;
}

// GET /api/v1/opportunities/[id]/documents/[docId] - Get a single document with version history
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, docId } = await params;

    // Fetch the document
    const document = await prisma.document.findFirst({
      where: {
        id: docId,
        opportunityId,
        organizationId: user.organization.id,
      },
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
        lastEditedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            name: true,
            accountName: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get version history - find the root document and all versions
    let rootDocumentId = document.id;
    let currentDoc = document;

    // Walk up to find the root
    while (currentDoc.parentVersionId) {
      const parent = await prisma.document.findUnique({
        where: { id: currentDoc.parentVersionId },
      });
      if (parent) {
        rootDocumentId = parent.id;
        currentDoc = parent as typeof document;
      } else {
        break;
      }
    }

    // Get all versions in the chain
    const allVersions = await prisma.document.findMany({
      where: {
        OR: [
          { id: rootDocumentId },
          { parentVersionId: rootDocumentId },
        ],
      },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // For nested versions, we need to recursively find them
    const versions = await getVersionChain(rootDocumentId);

    return NextResponse.json({
      document: {
        ...document,
        versions,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
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
    createdBy?: { id: string; name: string | null };
  }> = [];

  // Get root
  const root = await prisma.document.findUnique({
    where: { id: rootId },
    select: {
      id: true,
      version: true,
      createdAt: true,
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

// PATCH /api/v1/opportunities/[id]/documents/[docId] - Update a document
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, docId } = await params;

    // Verify document exists and user has access
    const existingDocument = await prisma.document.findFirst({
      where: {
        id: docId,
        opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!existingDocument) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const json = await req.json();
    const parsed = documentUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, content, structuredData } = parsed.data;

    // Update the document
    const document = await prisma.document.update({
      where: { id: docId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(structuredData !== undefined && { structuredData }),
        lastEditedById: user.id,
        lastEditedAt: new Date(),
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
        lastEditedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/opportunities/[id]/documents/[docId] - Delete a document
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, docId } = await params;

    // Verify document exists and user has access
    const existingDocument = await prisma.document.findFirst({
      where: {
        id: docId,
        opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!existingDocument) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete the document and all its versions
    // First, recursively delete child versions
    async function deleteWithChildren(id: string) {
      const children = await prisma.document.findMany({
        where: { parentVersionId: id },
        select: { id: true },
      });

      for (const child of children) {
        await deleteWithChildren(child.id);
      }

      await prisma.document.delete({ where: { id } });
    }

    await deleteWithChildren(docId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
