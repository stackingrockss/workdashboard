// src/app/api/v1/opportunities/[id]/mutual-action-plan/action-items/route.ts
// API endpoint for adding new action items to a MAP

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import { mapAddActionItemSchema } from "@/lib/validations/mutual-action-plan";
import type { MAPActionItem } from "@/types/mutual-action-plan";

/**
 * POST /api/v1/opportunities/[id]/mutual-action-plan/action-items
 * Add a new action item to the MAP
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
    const parsed = mapAddActionItemSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

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

    // Get existing MAP
    const existingMap = await prisma.mutualActionPlan.findUnique({
      where: { opportunityId },
    });

    if (!existingMap) {
      return NextResponse.json(
        { error: "Mutual action plan not found" },
        { status: 404 }
      );
    }

    // Get existing action items (cast through unknown for Prisma JSON type)
    const existingItems = (existingMap.actionItems as unknown as MAPActionItem[]) || [];

    // Calculate next order number
    const maxOrder = existingItems.length > 0
      ? Math.max(...existingItems.map((item) => item.order))
      : -1;

    // Create new action item
    const newItem: MAPActionItem = {
      id: createId(),
      description: parsed.data.description,
      targetDate: parsed.data.targetDate || undefined,
      status: parsed.data.status,
      owner: parsed.data.owner,
      notes: parsed.data.notes || undefined,
      isWeeklySync: parsed.data.isWeeklySync || false,
      order: maxOrder + 1,
    };

    // Add new item to the list
    const updatedItems = [...existingItems, newItem];

    // Update MAP
    const updatedMap = await prisma.mutualActionPlan.update({
      where: { id: existingMap.id },
      data: {
        actionItems: JSON.parse(JSON.stringify(updatedItems)),
        lastEditedById: user.id,
        lastEditedAt: new Date(),
      },
    });

    return NextResponse.json({
      actionItem: newItem,
      mutualActionPlan: updatedMap,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to add action item:", error);
    return NextResponse.json(
      { error: "Failed to add action item" },
      { status: 500 }
    );
  }
}
