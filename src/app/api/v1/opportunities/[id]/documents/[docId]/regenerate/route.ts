import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { documentRegenerateSchema } from "@/lib/validations/document";
import { inngest } from "@/lib/inngest/client";

interface RouteParams {
  params: Promise<{ id: string; docId: string }>;
}

// POST /api/v1/opportunities/[id]/documents/[docId]/regenerate - Regenerate document content
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, docId } = await params;

    // Fetch the existing document
    const existingDocument = await prisma.document.findFirst({
      where: {
        id: docId,
        opportunityId,
        organizationId: user.organization.id,
      },
      include: {
        brief: true,
      },
    });

    if (!existingDocument) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Only documents with a brief or MAPs can be regenerated
    const canRegenerate =
      existingDocument.briefId ||
      existingDocument.category === "mutual_action_plan";

    if (!canRegenerate) {
      return NextResponse.json(
        { error: "Only AI-generated documents can be regenerated" },
        { status: 400 }
      );
    }

    const json = await req.json();
    const parsed = documentRegenerateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { contextSelection } = parsed.data;

    // Create a new version of the document
    const newDocument = await prisma.document.create({
      data: {
        opportunityId: existingDocument.opportunityId,
        organizationId: existingDocument.organizationId,
        title: existingDocument.title,
        category: existingDocument.category,
        content: "", // Will be filled by the background job
        structuredData: existingDocument.category === "mutual_action_plan" ? { actionItems: [] } : Prisma.JsonNull,
        briefId: existingDocument.briefId,
        generationStatus: "pending",
        contextSnapshot: contextSelection,
        version: existingDocument.version + 1,
        parentVersionId: existingDocument.id,
        createdById: user.id,
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

    // Trigger background job for regeneration
    if (existingDocument.briefId) {
      await inngest.send({
        name: "document/generate-content",
        data: {
          documentId: newDocument.id,
          opportunityId: existingDocument.opportunityId,
          briefId: existingDocument.briefId,
          contextSelection,
          userId: user.id,
          organizationId: user.organization.id,
        },
      });
    } else if (existingDocument.category === "mutual_action_plan") {
      await inngest.send({
        name: "document/generate-map",
        data: {
          documentId: newDocument.id,
          opportunityId: existingDocument.opportunityId,
          templateContentId: null,
          userId: user.id,
          organizationId: user.organization.id,
        },
      });
    }

    return NextResponse.json({ document: newDocument }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error regenerating document:", error);
    return NextResponse.json(
      { error: "Failed to regenerate document" },
      { status: 500 }
    );
  }
}
