// src/app/api/v1/comments/route.ts
// API endpoints for comments (GET list, POST create)

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  commentCreateSchema,
  commentQuerySchema,
  type CommentCreateInput,
} from "@/lib/validations/comment";
import { broadcastCommentEvent } from "@/lib/realtime";

// GET /api/v1/comments?entityType=opportunity&entityId=abc123
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;

    // Parse and validate query parameters
    const queryValidation = commentQuerySchema.safeParse({
      entityType: searchParams.get("entityType"),
      entityId: searchParams.get("entityId"),
      includeResolved: searchParams.get("includeResolved"),
      pageContext: searchParams.get("pageContext") || undefined,
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryValidation.error.flatten() },
        { status: 400 }
      );
    }

    const { entityType, entityId, includeResolved, pageContext } = queryValidation.data;

    // Build where clause
    const where: any = {
      organizationId: user.organization.id,
      entityType,
      entityId,
      parentId: null, // Only top-level comments (replies are nested)
    };

    if (!includeResolved) {
      where.isResolved = false;
    }

    if (pageContext) {
      where.pageContext = pageContext;
    }

    // Fetch comments with relations
    const comments = await prisma.comment.findMany({
      where,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// POST /api/v1/comments
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate request body
    const validation = commentCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data: CommentCreateInput = validation.data;

    // Extract text selection fields
    const textSelection = data.textSelection
      ? {
          selectionType: data.textSelection.selectionType,
          anchorSelector: data.textSelection.anchorSelector,
          anchorOffset: data.textSelection.anchorOffset,
          focusSelector: data.textSelection.focusSelector,
          focusOffset: data.textSelection.focusOffset,
          selectedText: data.textSelection.selectedText,
        }
      : {
          selectionType: null,
          anchorSelector: null,
          anchorOffset: null,
          focusSelector: null,
          focusOffset: null,
          selectedText: null,
        };

    // Validate mentioned users exist and belong to same organization
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

    // If replying, verify parent comment exists and belongs to same entity
    if (data.parentId) {
      const parentComment = await prisma.comment.findFirst({
        where: {
          id: data.parentId,
          organizationId: user.organization.id,
          entityType: data.entityType,
          entityId: data.entityId,
        },
      });

      if (!parentComment) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }

      // Prevent nested replies beyond one level
      if (parentComment.parentId !== null) {
        return NextResponse.json(
          { error: "Cannot reply to a reply. Please reply to the parent comment." },
          { status: 400 }
        );
      }
    }

    // Create comment with mentions
    const comment = await prisma.comment.create({
      data: {
        content: data.content,
        authorId: user.id,
        organizationId: user.organization.id,
        entityType: data.entityType,
        entityId: data.entityId,
        pageContext: data.pageContext || null,
        ...textSelection,
        parentId: data.parentId || null,
        mentions: data.mentionedUserIds
          ? {
              create: data.mentionedUserIds.map((userId) => ({
                userId,
                organizationId: user.organization.id,
              })),
            }
          : undefined,
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
      data.entityType,
      data.entityId,
      {
        type: "comment:created",
        payload: { comment },
      }
    );

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
