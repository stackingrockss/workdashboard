// src/app/api/v1/opportunities/[id]/mutual-action-plan/action-items/[itemId]/route.ts
// API endpoint for updating/deleting individual action items

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { mapActionItemUpdateSchema } from "@/lib/validations/mutual-action-plan";
import type { MAPActionItem } from "@/types/mutual-action-plan";

/**
 * PATCH /api/v1/opportunities/[id]/mutual-action-plan/action-items/[itemId]
 * Update a single action item
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: opportunityId, itemId } = await params;

  try {
    const user = await requireAuth();

    // Validate request body
    const json = await req.json();
    const parsed = mapActionItemUpdateSchema.safeParse(json);
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

    // Find the item to update
    const itemIndex = existingItems.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: "Action item not found" },
        { status: 404 }
      );
    }

    // Update the item with provided fields
    const updatedItem: MAPActionItem = {
      ...existingItems[itemIndex],
      ...parsed.data,
      // Handle completion date - set it when status changes to completed
      completionDate:
        parsed.data.status === "completed" &&
        existingItems[itemIndex].status !== "completed"
          ? new Date().toISOString().split("T")[0]
          : parsed.data.status !== "completed"
            ? undefined
            : existingItems[itemIndex].completionDate,
    };

    // Replace the item in the list
    const updatedItems = [...existingItems];
    updatedItems[itemIndex] = updatedItem;

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
      actionItem: updatedItem,
      mutualActionPlan: updatedMap,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to update action item:", error);
    return NextResponse.json(
      { error: "Failed to update action item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/opportunities/[id]/mutual-action-plan/action-items/[itemId]
 * Delete a single action item
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: opportunityId, itemId } = await params;

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

    // Find the item to delete
    const itemIndex = existingItems.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: "Action item not found" },
        { status: 404 }
      );
    }

    // Remove the item from the list
    const updatedItems = existingItems.filter((item) => item.id !== itemId);

    // Re-order remaining items
    const reorderedItems = updatedItems.map((item, index) => ({
      ...item,
      order: index,
    }));

    // Update MAP
    const updatedMap = await prisma.mutualActionPlan.update({
      where: { id: existingMap.id },
      data: {
        actionItems: JSON.parse(JSON.stringify(reorderedItems)),
        lastEditedById: user.id,
        lastEditedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Action item deleted",
      mutualActionPlan: updatedMap,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to delete action item:", error);
    return NextResponse.json(
      { error: "Failed to delete action item" },
      { status: 500 }
    );
  }
}
