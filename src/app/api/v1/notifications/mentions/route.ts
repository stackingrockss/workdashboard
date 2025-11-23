// src/app/api/v1/notifications/mentions/route.ts
// API endpoint for fetching and managing comment mention notifications

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notificationQuerySchema, notificationMarkReadSchema } from "@/lib/validations/notification";

/**
 * GET /api/v1/notifications/mentions
 * Fetch user's comment mentions (notifications)
 *
 * Query params:
 * - limit: number (default: 10, max: 100)
 * - includeRead: boolean (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = notificationQuerySchema.safeParse({
      limit: searchParams.get("limit"),
      includeRead: searchParams.get("includeRead"),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryValidation.error.flatten() },
        { status: 400 }
      );
    }

    const { limit, includeRead } = queryValidation.data;

    // Fetch mentions for the current user
    const mentions = await prisma.commentMention.findMany({
      where: {
        userId: user.id,
        organizationId: user.organization.id,
        ...(includeRead ? {} : { isRead: false }), // Only unread if includeRead is false
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        comment: {
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

    // Calculate unread count
    const unreadCount = await prisma.commentMention.count({
      where: {
        userId: user.id,
        organizationId: user.organization.id,
        isRead: false,
      },
    });

    // Transform mentions to include relevant comment data
    const notifications = mentions.map((mention) => ({
      id: mention.id,
      commentId: mention.commentId,
      comment: {
        id: mention.comment.id,
        content: mention.comment.content.slice(0, 200), // Truncate to 200 chars
        contentPreview: mention.comment.content.slice(0, 80), // Short preview for UI
        contentLength: mention.comment.content.length,
        entityType: mention.comment.entityType,
        entityId: mention.comment.entityId,
        pageContext: mention.comment.pageContext,
        createdAt: mention.comment.createdAt.toISOString(),
        author: mention.comment.author,
      },
      isRead: mention.isRead,
      createdAt: mention.createdAt.toISOString(),
      readAt: mention.readAt?.toISOString() || null,
    }));

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching mentions:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/notifications/mentions
 * Mark mention notifications as read
 *
 * Body:
 * - mentionIds: string[] (array of mention IDs to mark as read)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate request body
    const validation = notificationMarkReadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { mentionIds } = validation.data;

    // Verify all mentions belong to the current user
    const mentions = await prisma.commentMention.findMany({
      where: {
        id: { in: mentionIds },
        userId: user.id,
        organizationId: user.organization.id,
      },
    });

    if (mentions.length !== mentionIds.length) {
      return NextResponse.json(
        { error: "One or more mentions not found or do not belong to you" },
        { status: 403 }
      );
    }

    // Mark mentions as read
    await prisma.commentMention.updateMany({
      where: {
        id: { in: mentionIds },
        userId: user.id,
        organizationId: user.organization.id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      markedAsRead: mentionIds.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error marking mentions as read:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
