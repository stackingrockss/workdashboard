import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accountUpdateSchema } from "@/lib/validations/account";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

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
 * Also attempts to match to specific opportunities by title
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

  // Get all unassociated calendar events for org users (no accountId or no opportunityId)
  const unmatchedEvents = await prisma.calendarEvent.findMany({
    where: {
      userId: { in: userIds },
      OR: [
        { accountId: null },
        { opportunityId: null },
      ],
    },
    select: {
      id: true,
      summary: true,
      attendees: true,
      accountId: true,
      opportunityId: true,
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

  // Get account with opportunities for linking
  const accountWithOpps = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      opportunities: { select: { id: true, name: true } },
    },
  });

  const opportunities = accountWithOpps?.opportunities || [];
  let linkedCount = 0;

  // Process each event individually to match to specific opportunity
  for (const event of matchingEvents) {
    let opportunityId: string | null = event.opportunityId;

    // Only try to match opportunity if not already set
    if (!opportunityId && opportunities.length > 0) {
      if (opportunities.length === 1) {
        // Single opportunity - always link
        opportunityId = opportunities[0].id;
      } else {
        // Multiple opportunities - try to match by title
        const meetingTitle = (event.summary || "").toLowerCase();
        const matchedOpp = opportunities.find(
          (opp) =>
            meetingTitle.includes(opp.name.toLowerCase()) ||
            opp.name.toLowerCase().includes(meetingTitle)
        );
        if (matchedOpp) {
          opportunityId = matchedOpp.id;
        }
      }
    }

    // Update if we have something new to set
    if (!event.accountId || (!event.opportunityId && opportunityId)) {
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: {
          accountId: event.accountId || accountId,
          ...(opportunityId && !event.opportunityId && { opportunityId }),
        },
      });
      linkedCount++;
    }
  }

  return linkedCount;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
      include: {
        opportunities: {
          include: {
            owner: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ account }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching account:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const data = accountUpdateSchema.parse(body);

    // Fetch existing account to compare website changes
    const existingAccount = await prisma.account.findUnique({
      where: { id },
      select: { website: true, organizationId: true },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Verify the account belongs to user's organization
    if (existingAccount.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        name: data.name,
        website: data.website,
        industry: data.industry,
        priority: data.priority,
        health: data.health,
        notes: data.notes,
      },
    });

    // Backfill calendar events if website changed
    let calendarEventsLinked = 0;
    const oldDomain = existingAccount.website
      ? extractDomainFromWebsite(existingAccount.website)
      : null;
    const newDomain = account.website
      ? extractDomainFromWebsite(account.website)
      : null;

    // Trigger backfill if website was added or domain changed
    if (account.website && newDomain !== oldDomain) {
      try {
        calendarEventsLinked = await backfillCalendarEventsForAccount(
          account.id,
          account.website,
          user.organization.id
        );
        if (calendarEventsLinked > 0) {
          console.log(
            `[Account Update] Linked ${calendarEventsLinked} calendar events to account ${account.name}`
          );
        }
      } catch (backfillError) {
        // Log but don't fail account update
        console.error("[Account Update] Calendar backfill failed:", backfillError);
      }
    }

    return NextResponse.json({ account, calendarEventsLinked }, { status: 200 });
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

    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Verify account belongs to user's organization
    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Check if account has opportunities
    const opportunityCount = await prisma.opportunity.count({
      where: {
        accountId: id,
        organizationId: user.organization.id,
      },
    });

    if (opportunityCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with associated opportunities" },
        { status: 400 }
      );
    }

    await prisma.account.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
