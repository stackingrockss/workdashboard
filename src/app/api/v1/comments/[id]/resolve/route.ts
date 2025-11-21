// src/app/api/v1/comments/[id]/resolve/route.ts
// API endpoint for resolving/unresolving comments

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commentResolveSchema } from "@/lib/validations/comment";
import { broadcastCommentEvent } from "@/lib/realtime";

// PATCH /api/v1/comments/[id]/resolve
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();

    // Validate request body
    const validation = commentResolveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { isResolved } = validation.data;

    // Find comment
    const existingComment = await prisma.comment.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Permissions: author, ADMIN, or MANAGER can resolve
    const canResolve =
      existingComment.authorId === user.id ||
      user.role === "ADMIN" ||
      user.role === "MANAGER";

    if (!canResolve) {
      return NextResponse.json(
        { error: "You don't have permission to resolve this comment" },
        { status: 403 }
      );
    }

    // Update comment resolution status
    const comment = await prisma.comment.update({
      where: { id },
      data: {
        isResolved,
        resolvedAt: isResolved ? new Date() : null,
        resolvedById: isResolved ? user.id : null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Broadcast real-time event to all connected clients
    await broadcastCommentEvent(
      user.organization.id,
      existingComment.entityType,
      existingComment.entityId,
      {
        type: "comment:resolved",
        payload: { commentId: id, isResolved },
      }
    );

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Error resolving comment:", error);
    return NextResponse.json({ error: "Failed to resolve comment" }, { status: 500 });
  }
}
