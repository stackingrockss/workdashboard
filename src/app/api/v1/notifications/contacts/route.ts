// src/app/api/v1/notifications/contacts/route.ts
// API endpoint for fetching and managing contact import notifications

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  contactNotificationQuerySchema,
  contactNotificationMarkReadSchema,
} from "@/lib/validations/notification";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";
import { Prisma } from "@prisma/client";

/**
 * GET /api/v1/notifications/contacts
 * Fetch user's contact import ready notifications
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
    const queryValidation = contactNotificationQuerySchema.safeParse({
      limit: searchParams.get("limit"),
      includeRead: searchParams.get("includeRead"),
      opportunityId: searchParams.get("opportunityId"),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryValidation.error.flatten() },
        { status: 400 }
      );
    }

    const { includeRead, opportunityId } = queryValidation.data;

    // Check if ContactsReadyNotification table exists
    try {
      await prisma.contactsReadyNotification.findFirst({ take: 1 });
    } catch (tableError) {
      if (tableError instanceof Error && tableError.message.includes('relation') && tableError.message.includes('does not exist')) {
        console.warn("[contacts-notifications-api] ContactsReadyNotification table does not exist - returning empty notifications");
        return cachedResponse({
          notifications: [],
          unreadCount: 0,
        }, 'realtime');
      }
      throw tableError;
    }

    const whereClause = {
      userId: user.id,
      organizationId: user.organization.id,
      ...(includeRead ? {} : { isRead: false }),
      ...(opportunityId ? { opportunityId } : {}),
    };

    // Define include for relations
    const includeRelations = {
      gongCall: {
        select: {
          id: true,
          title: true,
          meetingDate: true,
          parsedPeople: true,
        },
      },
      granolaNote: {
        select: {
          id: true,
          title: true,
          meetingDate: true,
          parsedPeople: true,
        },
      },
    };

    // Helper to transform notifications
    type NotificationWithRelations = Prisma.ContactsReadyNotificationGetPayload<{
      include: typeof includeRelations;
    }>;

    const transformNotification = (notification: NotificationWithRelations) => ({
      id: notification.id,
      type: "contacts_ready" as const,
      contactCount: notification.contactCount,
      opportunityId: notification.opportunityId,
      opportunityName: notification.opportunityName,
      callTitle: notification.callTitle,
      gongCallId: notification.gongCallId,
      granolaNoteId: notification.granolaNoteId,
      // Include the actual parsed people data for the import dialog
      parsedPeople: notification.gongCall?.parsedPeople || notification.granolaNote?.parsedPeople || null,
      meetingDate: notification.gongCall?.meetingDate?.toISOString() ||
                   notification.granolaNote?.meetingDate?.toISOString() || null,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() || null,
    });

    const usePagination = wantsPagination(searchParams);

    // Calculate unread count
    const unreadCount = await prisma.contactsReadyNotification.count({
      where: {
        userId: user.id,
        organizationId: user.organization.id,
        isRead: false,
      },
    });

    if (usePagination) {
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 50,
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 50;
      const skip = (page - 1) * limit;

      const [total, notifications] = await Promise.all([
        prisma.contactsReadyNotification.count({ where: whereClause }),
        prisma.contactsReadyNotification.findMany({
          where: whereClause,
          include: includeRelations,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      const transformedNotifications = notifications.map(transformNotification);

      return cachedResponse({
        ...buildPaginatedResponse(transformedNotifications, page, limit, total, 'notifications'),
        unreadCount,
      }, 'realtime');
    } else {
      const legacyLimit = queryValidation.data.limit;

      const notifications = await prisma.contactsReadyNotification.findMany({
        where: whereClause,
        include: includeRelations,
        orderBy: { createdAt: "desc" },
        take: legacyLimit,
      });

      const transformedNotifications = notifications.map(transformNotification);

      return cachedResponse({
        ...buildLegacyResponse(transformedNotifications, 'notifications'),
        unreadCount,
      }, 'realtime');
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[contacts-notifications-api] Error fetching notifications:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch contact notifications",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/notifications/contacts
 * Mark contact notifications as read
 *
 * Body:
 * - notificationIds: string[] (array of notification IDs to mark as read)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const validation = contactNotificationMarkReadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { notificationIds } = validation.data;

    // Verify all notifications belong to the current user
    const notifications = await prisma.contactsReadyNotification.findMany({
      where: {
        id: { in: notificationIds },
        userId: user.id,
        organizationId: user.organization.id,
      },
    });

    if (notifications.length !== notificationIds.length) {
      return NextResponse.json(
        { error: "One or more notifications not found or do not belong to you" },
        { status: 403 }
      );
    }

    // Mark notifications as read
    await prisma.contactsReadyNotification.updateMany({
      where: {
        id: { in: notificationIds },
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
      markedAsRead: notificationIds.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[contacts-notifications-api] Error marking notifications as read:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
