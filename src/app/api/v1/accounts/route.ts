import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accountCreateSchema } from "@/lib/validations/account";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

/**
 * Extracts the domain from a website URL
 * @param website - The website URL (with or without protocol)
 * @returns The normalized domain (lowercase, no www) or null if invalid
 */
function extractDomainFromWebsite(website: string): string | null {
  try {
    const url = new URL(
      website.startsWith("http") ? website : `https://${website}`
    );
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Backfills calendar events that match an account's domain
 * Links unassociated calendar events to the account based on attendee email domains
 */
async function backfillCalendarEventsForAccount(
  accountId: string,
  website: string,
  organizationId: string
): Promise<number> {
  const domain = extractDomainFromWebsite(website);
  if (!domain) {
    return 0;
  }

  // Get all user IDs in the organization
  const orgUsers = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const userIds = orgUsers.map((u) => u.id);

  if (userIds.length === 0) {
    return 0;
  }

  // Get all unassociated calendar events for org users
  const unmatchedEvents = await prisma.calendarEvent.findMany({
    where: {
      userId: { in: userIds },
      accountId: null,
    },
    select: {
      id: true,
      attendees: true,
    },
  });

  // Filter events that have attendees matching the account's domain
  const matchingEvents = unmatchedEvents.filter((event) =>
    event.attendees.some((email) => {
      const emailDomain = email.split("@")[1]?.toLowerCase();
      return emailDomain === domain;
    })
  );

  if (matchingEvents.length === 0) {
    return 0;
  }

  // Check if account has opportunities for linking
  const accountWithOpps = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      opportunities: { select: { id: true, name: true } },
    },
  });

  // Determine opportunityId to set (only if exactly 1 opportunity)
  const opportunityId =
    accountWithOpps?.opportunities.length === 1
      ? accountWithOpps.opportunities[0].id
      : null;

  // Update all matching events
  await prisma.calendarEvent.updateMany({
    where: {
      id: { in: matchingEvents.map((e) => e.id) },
    },
    data: {
      accountId,
      ...(opportunityId && { opportunityId }),
    },
  });

  return matchingEvents.length;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = req.nextUrl.searchParams;

    // Build where clause (scoped to user's organization)
    const whereClause = {
      organizationId: user.organization.id,
    };

    // Detect if client wants pagination
    const usePagination = wantsPagination(searchParams);

    if (usePagination) {
      // PAGINATED MODE: Client requested pagination via query params
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 100, // Default to 100
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 100; // Ensure limit is never undefined
      const skip = (page - 1) * limit;

      // Parallel queries for performance (count total + fetch page)
      const [total, accounts] = await Promise.all([
        prisma.account.count({ where: whereClause }),
        prisma.account.findMany({
          where: whereClause,
          include: {
            opportunities: {
              select: {
                id: true,
                name: true,
                amountArr: true,
                confidenceLevel: true,
                stage: true,
              },
            },
            owner: true,
          },
          orderBy: { name: "asc" },
          skip,
          take: limit,
        }),
      ]);

      return cachedResponse(
        buildPaginatedResponse(accounts, page, limit, total, 'accounts'),
        'frequent'
      );
    } else {
      // LEGACY MODE: No pagination params, return all accounts
      const accounts = await prisma.account.findMany({
        where: whereClause,
        include: {
          opportunities: {
            select: {
              id: true,
              name: true,
              amountArr: true,
              confidenceLevel: true,
              stage: true,
            },
          },
          owner: true,
        },
        orderBy: { name: "asc" },
      });

      return cachedResponse(
        buildLegacyResponse(accounts, 'accounts'),
        'frequent'
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const data = accountCreateSchema.parse(body);

    // Check for existing account with case-insensitive name match
    const existingAccount = await prisma.account.findFirst({
      where: {
        organizationId: user.organization.id,
        name: {
          equals: data.name,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        website: true,
        industry: true,
      },
    });

    if (existingAccount) {
      return NextResponse.json(
        {
          error: "duplicate",
          message: `An account named "${existingAccount.name}" already exists`,
          existingAccount,
        },
        { status: 409 }
      );
    }

    const account = await prisma.account.create({
      data: {
        name: data.name,
        website: data.website,
        industry: data.industry,
        priority: data.priority,
        health: data.health,
        notes: data.notes,
        organizationId: user.organization.id, // Required field
        ownerId: data.ownerId ?? user.id, // Use provided ownerId or default to current user
      },
    });

    // Backfill calendar events that match the account's domain
    let calendarEventsLinked = 0;
    if (account.website) {
      try {
        calendarEventsLinked = await backfillCalendarEventsForAccount(
          account.id,
          account.website,
          user.organization.id
        );
        if (calendarEventsLinked > 0) {
          console.log(
            `[Account Create] Linked ${calendarEventsLinked} calendar events to account ${account.name}`
          );
        }
      } catch (backfillError) {
        // Log but don't fail account creation
        console.error("[Account Create] Calendar backfill failed:", backfillError);
      }
    }

    return NextResponse.json({ account, calendarEventsLinked }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
