// app/opportunities/[id]/documents/[docId]/page.tsx
// Server component: displays a document editor for a specific document

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuthOrRedirect } from "@/lib/auth";
import { DocumentEditorClient } from "./document-editor-client";

interface DocumentPageProps {
  params: Promise<{ id: string; docId: string }>;
}

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id: opportunityId, docId } = await params;

  // Require authentication
  const user = await requireAuthOrRedirect();

  // Fetch the document with related data
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

  if (!document) return notFound();

  // Fetch version history
  let rootDocumentId = document.id;
  let currentDoc: typeof document | null = document;

  // Walk up to find the root
  while (currentDoc?.parentVersionId) {
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
  const versions = await getVersionChain(rootDocumentId);

  // Transform document for client
  const documentData = {
    id: document.id,
    opportunityId: document.opportunityId,
    organizationId: document.organizationId,
    title: document.title,
    documentType: document.documentType,
    content: document.content || undefined,
    structuredData: document.structuredData as { actionItems: unknown[] } | null,
    frameworkId: document.frameworkId || undefined,
    generationStatus: document.generationStatus || undefined,
    generatedAt: document.generatedAt?.toISOString() || undefined,
    generationError: document.generationError || undefined,
    contextSnapshot: document.contextSnapshot as Record<string, unknown> | null,
    version: document.version,
    parentVersionId: document.parentVersionId || undefined,
    createdById: document.createdById,
    lastEditedById: document.lastEditedById || undefined,
    lastEditedAt: document.lastEditedAt?.toISOString() || undefined,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    framework: document.framework || undefined,
    createdBy: document.createdBy || undefined,
    lastEditedBy: document.lastEditedBy || undefined,
    opportunity: document.opportunity,
    versions,
  };

  return (
    <DocumentEditorClient
      document={documentData}
      currentUserId={user.id}
    />
  );
}

// Helper function to get all versions in a chain
async function getVersionChain(rootId: string) {
  const versions: Array<{
    id: string;
    version: number;
    createdAt: string;
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
    versions.push({
      ...root,
      createdAt: root.createdAt.toISOString(),
    });
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
      versions.push({
        ...child,
        createdAt: child.createdAt.toISOString(),
      });
      await getChildren(child.id);
    }
  }

  await getChildren(rootId);

  // Sort by version descending
  versions.sort((a, b) => b.version - a.version);

  return versions;
}
