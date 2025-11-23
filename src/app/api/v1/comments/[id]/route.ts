// src/app/api/v1/comments/[id]/route.ts
// API endpoints for individual comments (GET, PATCH, DELETE)

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  commentUpdateSchema,
  type CommentUpdateInput,
} from "@/lib/validations/comment";
import { broadcastCommentEvent } from "@/lib/realtime";

// GET /api/v1/comments/[id]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;

    const comment = await prisma.comment.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
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
            mentions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            reactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Error fetching comment:", error);
    return NextResponse.json({ error: "Failed to fetch comment" }, { status: 500 });
  }
}

// PATCH /api/v1/comments/[id]
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();

    // Validate request body
    const validation = commentUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data: CommentUpdateInput = validation.data;

    // Find comment and verify ownership or admin role
    const existingComment = await prisma.comment.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check permissions: only author or ADMIN can edit
    if (existingComment.authorId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "You can only edit your own comments" },
        { status: 403 }
      );
    }

    // Validate mentioned users if provided
    if (data.mentionedUserIds && data.mentionedUserIds.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          id: { in: data.mentionedUserIds },
          organizationId: user.organization.id,
        },
      });

      if (mentionedUsers.length !== data.mentionedUserIds.length) {
        return NextResponse.json(
          { error: "One or more mentioned users not found or not in your organization" },
          { status: 400 }
        );
      }
    }

    // Update comment
    const comment = await prisma.comment.update({
      where: { id },
      data: {
        content: data.content,
        editedAt: new Date(),
        // Update mentions: delete old ones and create new ones
        mentions: {
          deleteMany: {},
          create: data.mentionedUserIds
            ? data.mentionedUserIds.map((userId) => ({
                userId,
                organizationId: user.organization.id,
              }))
            : [],
        },
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
            mentions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            reactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
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
        type: "comment:updated",
        payload: { comment },
      }
    );

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

// DELETE /api/v1/comments/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;

    // Find comment and verify ownership or admin role
    const existingComment = await prisma.comment.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check permissions: only author or ADMIN can delete
    if (existingComment.authorId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    // Delete comment (cascade will delete mentions and reactions)
    await prisma.comment.delete({
      where: { id },
    });

    // Broadcast real-time event to all connected clients
    await broadcastCommentEvent(
      user.organization.id,
      existingComment.entityType,
      existingComment.entityId,
      {
        type: "comment:deleted",
        payload: { commentId: id },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
