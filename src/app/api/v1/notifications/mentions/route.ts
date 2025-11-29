// src/app/api/v1/notifications/mentions/route.ts
// API endpoint for fetching and managing comment mention notifications

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notificationQuerySchema, notificationMarkReadSchema } from "@/lib/validations/notification";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";
import { Prisma } from "@prisma/client";

/**
 * GET /api/v1/notifications/mentions
 * Fetch user's comment mentions (notifications)
 *
 * Query params:
 * - page: number (optional, pagination page)
 * - limit: number (optional, pagination limit or legacy limit, default: 50 for pagination, 10 for legacy)
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

    const { includeRead } = queryValidation.data;

    const whereClause = {
      userId: user.id,
      organizationId: user.organization.id,
      ...(includeRead ? {} : { isRead: false }), // Only unread if includeRead is false
    };

    // Define include for relations
    const includeRelations = {
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
    };

    // Helper to transform mentions
    type MentionWithComment = Prisma.CommentMentionGetPayload<{
      include: typeof includeRelations;
    }>;
    const transformMention = (mention: MentionWithComment) => ({
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
    });

    const usePagination = wantsPagination(searchParams);

    // Calculate unread count (always include for notifications)
    const unreadCount = await prisma.commentMention.count({
      where: {
        userId: user.id,
        organizationId: user.organization.id,
        isRead: false,
      },
    });

    if (usePagination) {
      // PAGINATED MODE: Client requested pagination via query params
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 50,
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 50;
      const skip = (page - 1) * limit;

      // Parallel queries for performance
      const [total, mentions] = await Promise.all([
        prisma.commentMention.count({ where: whereClause }),
        prisma.commentMention.findMany({
          where: whereClause,
          include: includeRelations,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      const notifications = mentions.map(transformMention);

      return cachedResponse({
        ...buildPaginatedResponse(notifications, page, limit, total, 'notifications'),
        unreadCount,
      }, 'realtime');
    } else {
      // LEGACY MODE: Use existing limit param (default 10, max 100)
      const legacyLimit = queryValidation.data.limit; // Already validated by notificationQuerySchema

      const mentions = await prisma.commentMention.findMany({
        where: whereClause,
        include: includeRelations,
        orderBy: { createdAt: "desc" },
        take: legacyLimit,
      });

      const notifications = mentions.map(transformMention);

      return cachedResponse({
        ...buildLegacyResponse(notifications, 'notifications'),
        unreadCount,
      }, 'realtime');
    }
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
