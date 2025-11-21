// src/app/api/v1/comments/[id]/reactions/route.ts
// API endpoints for comment reactions (POST add, DELETE remove)

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reactionCreateSchema } from "@/lib/validations/comment";
import { broadcastCommentEvent } from "@/lib/realtime";

// POST /api/v1/comments/[id]/reactions
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: commentId } = await context.params;
    const body = await request.json();

    // Validate request body
    const validation = reactionCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { emoji } = validation.data;

    // Verify comment exists and belongs to organization
    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        organizationId: user.organization.id,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check if user already reacted with this emoji
    const existingReaction = await prisma.commentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId: user.id,
          emoji,
        },
      },
    });

    if (existingReaction) {
      // Toggle: remove reaction if already exists
      await prisma.commentReaction.delete({
        where: {
          id: existingReaction.id,
        },
      });

      // Broadcast real-time event to all connected clients
      await broadcastCommentEvent(
        user.organization.id,
        comment.entityType,
        comment.entityId,
        {
          type: "reaction:toggled",
          payload: {
            commentId,
            reaction: {
              id: existingReaction.id,
              emoji,
              userId: user.id,
              user: {
                id: user.id,
                name: user.name,
              },
            },
            action: "removed",
          },
        }
      );

      return NextResponse.json({ success: true, action: "removed" });
    } else {
      // Add new reaction
      const reaction = await prisma.commentReaction.create({
        data: {
          commentId,
          userId: user.id,
          emoji,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Broadcast real-time event to all connected clients
      await broadcastCommentEvent(
        user.organization.id,
        comment.entityType,
        comment.entityId,
        {
          type: "reaction:toggled",
          payload: {
            commentId,
            reaction,
            action: "added",
          },
        }
      );

      return NextResponse.json({ reaction, action: "added" }, { status: 201 });
    }
  } catch (error) {
    console.error("Error adding reaction:", error);
    return NextResponse.json({ error: "Failed to add reaction" }, { status: 500 });
  }
}

// DELETE /api/v1/comments/[id]/reactions/[emoji]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: commentId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const emoji = searchParams.get("emoji");

    if (!emoji) {
      return NextResponse.json({ error: "Emoji parameter is required" }, { status: 400 });
    }

    // Verify comment exists and belongs to organization
    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        organizationId: user.organization.id,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Find and delete reaction
    const reaction = await prisma.commentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId: user.id,
          emoji,
        },
      },
    });

    if (!reaction) {
      return NextResponse.json({ error: "Reaction not found" }, { status: 404 });
    }

    await prisma.commentReaction.delete({
      where: {
        id: reaction.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing reaction:", error);
    return NextResponse.json({ error: "Failed to remove reaction" }, { status: 500 });
  }
}
