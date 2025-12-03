// src/app/api/v1/opportunities/[id]/mutual-action-plan/route.ts
// API endpoints for Mutual Action Plan CRUD operations

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { ParsingStatus } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import {
  mapGenerateSchema,
  mapUpdateSchema,
} from "@/lib/validations/mutual-action-plan";
import type { MAPActionItem } from "@/types/mutual-action-plan";

/**
 * GET /api/v1/opportunities/[id]/mutual-action-plan
 * Fetch the MAP for an opportunity
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opportunityId } = await params;

  try {
    const user = await requireAuth();

    // Verify opportunity belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
      },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Fetch MAP if it exists
    const map = await prisma.mutualActionPlan.findUnique({
      where: { opportunityId },
      include: {
        lastEditedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        templateContent: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Also get meeting count for the UI to determine if generation is enabled
    const [gongCount, granolaCount] = await Promise.all([
      prisma.gongCall.count({
        where: {
          opportunityId,
          parsingStatus: ParsingStatus.completed,
        },
      }),
      prisma.granolaNote.count({
        where: {
          opportunityId,
          parsingStatus: ParsingStatus.completed,
        },
      }),
    ]);

    return NextResponse.json({
      mutualActionPlan: map,
      meetingCount: gongCount + granolaCount,
      canGenerate: gongCount + granolaCount >= 1,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch MAP:", error);
    return NextResponse.json(
      { error: "Failed to fetch mutual action plan" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/opportunities/[id]/mutual-action-plan
 * Generate a new MAP (triggers Inngest job)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opportunityId } = await params;

  try {
    const user = await requireAuth();

    // Validate request body
    const json = await req.json();
    const parsed = mapGenerateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { templateContentId } = parsed.data;

    // Verify opportunity belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
      },
      select: { id: true, organizationId: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Check if at least 1 parsed meeting exists
    const [gongCount, granolaCount] = await Promise.all([
      prisma.gongCall.count({
        where: {
          opportunityId,
          parsingStatus: ParsingStatus.completed,
        },
      }),
      prisma.granolaNote.count({
        where: {
          opportunityId,
          parsingStatus: ParsingStatus.completed,
        },
      }),
    ]);

    if (gongCount + granolaCount < 1) {
      return NextResponse.json(
        {
          error: "At least 1 parsed meeting is required to generate a MAP",
          meetingCount: gongCount + granolaCount,
        },
        { status: 400 }
      );
    }

    // Validate template if provided
    if (templateContentId) {
      const template = await prisma.content.findFirst({
        where: {
          id: templateContentId,
          organizationId: user.organization.id,
          contentType: "mutual_action_plan",
        },
      });

      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
    }

    // Create or update MAP record with pending status
    const existingMap = await prisma.mutualActionPlan.findUnique({
      where: { opportunityId },
    });

    let mapId: string;

    if (existingMap) {
      // Update existing MAP - increment version
      await prisma.mutualActionPlan.update({
        where: { id: existingMap.id },
        data: {
          generationStatus: "pending",
          generationError: null,
          version: { increment: 1 },
        },
      });
      mapId = existingMap.id;
    } else {
      // Create new MAP
      const newMap = await prisma.mutualActionPlan.create({
        data: {
          id: createId(),
          opportunityId,
          organizationId: opportunity.organizationId,
          generationStatus: "pending",
          actionItems: [],
        },
      });
      mapId = newMap.id;
    }

    // Trigger Inngest job
    await inngest.send({
      name: "map/generate",
      data: {
        mapId,
        opportunityId,
        templateContentId,
        userId: user.id,
      },
    });

    return NextResponse.json(
      {
        message: "MAP generation started",
        mapId,
        generationStatus: "pending",
      },
      { status: 202 } // 202 Accepted - job is processing in background
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to generate MAP:", error);
    return NextResponse.json(
      { error: "Failed to generate mutual action plan" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/opportunities/[id]/mutual-action-plan
 * Update MAP (title or action items)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opportunityId } = await params;

  try {
    const user = await requireAuth();

    // Validate request body
    const json = await req.json();
    const parsed = mapUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, actionItems } = parsed.data;

    // Verify opportunity belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
      },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Verify MAP exists
    const existingMap = await prisma.mutualActionPlan.findUnique({
      where: { opportunityId },
    });

    if (!existingMap) {
      return NextResponse.json(
        { error: "Mutual action plan not found" },
        { status: 404 }
      );
    }

    // Build update data - use Prisma.JsonValue for JSON field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      lastEditedById: user.id,
      lastEditedAt: new Date(),
    };

    if (title !== undefined) {
      updateData.title = title;
    }

    if (actionItems !== undefined) {
      // Convert to JSON-compatible format for Prisma
      updateData.actionItems = JSON.parse(JSON.stringify(actionItems));
    }

    // Update MAP
    const updatedMap = await prisma.mutualActionPlan.update({
      where: { id: existingMap.id },
      data: updateData,
      include: {
        lastEditedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ mutualActionPlan: updatedMap });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to update MAP:", error);
    return NextResponse.json(
      { error: "Failed to update mutual action plan" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/opportunities/[id]/mutual-action-plan
 * Delete the MAP for an opportunity
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opportunityId } = await params;

  try {
    const user = await requireAuth();

    // Verify opportunity belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
      },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Delete MAP if it exists
    await prisma.mutualActionPlan.deleteMany({
      where: { opportunityId },
    });

    return NextResponse.json({ message: "Mutual action plan deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to delete MAP:", error);
    return NextResponse.json(
      { error: "Failed to delete mutual action plan" },
      { status: 500 }
    );
  }
}
