import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { z } from "zod";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createBIPSchema = z.object({
  additionalContext: z.string().max(5000).optional(),
});

// POST /api/v1/opportunities/[id]/documents/bip - Create and generate a new BIP
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

    // Verify opportunity access
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
      },
      select: { id: true, name: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const json = await req.json();
    const parsed = createBIPSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { additionalContext } = parsed.data;

    // Create document record with pending status
    const document = await prisma.document.create({
      data: {
        opportunityId,
        organizationId: user.organization.id,
        title: `Business Impact Proposal - ${opportunity.name}`,
        category: "business_impact_proposal",
        content: "",
        generationStatus: "pending",
        version: 1,
        createdById: user.id,
        contextSnapshot: additionalContext ? { additionalContext } : Prisma.JsonNull,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    // Trigger Inngest background job
    await inngest.send({
      name: "document/generate-bip",
      data: {
        documentId: document.id,
        opportunityId,
        additionalContext: additionalContext || null,
        userId: user.id,
        organizationId: user.organization.id,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating BIP document:", error);
    return NextResponse.json(
      { error: "Failed to create BIP document" },
      { status: 500 }
    );
  }
}
