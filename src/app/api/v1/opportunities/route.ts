import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { opportunityCreateSchema } from "@/lib/validations/opportunity";
import { requireAuth } from "@/lib/auth";
import { getQuarterFromDate, parseISODateSafe } from "@/lib/utils/quarter";
import { mapPrismaOpportunitiesToOpportunities, mapPrismaOpportunityToOpportunity } from "@/lib/mappers/opportunity";
import { getVisibleUserIds, isAdmin } from "@/lib/permissions";
import { triggerAccountResearchGeneration } from "@/lib/inngest/functions/generate-account-research";

export async function GET() {
  try {
    const user = await requireAuth();

    // Get visible user IDs based on role and direct reports
    const visibleUserIds = getVisibleUserIds(user, user.directReports);

    // Build where clause based on visibility
    const whereClause = isAdmin(user)
      ? { organizationId: user.organization.id } // Admin sees all in org
      : { ownerId: { in: visibleUserIds } }; // Others see based on visibility

    const opportunitiesFromDB = await prisma.opportunity.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      include: {
        owner: true,
        account: true,
      },
      take: 100,
    });
    const opportunities = mapPrismaOpportunitiesToOpportunities(opportunitiesFromDB);
    return NextResponse.json({ opportunities });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch opportunities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();

    const parsed = opportunityCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // If account name is provided instead of accountId, find or create the account
    let accountId = data.accountId;
    if (!accountId && data.account) {
      // First check if account exists to determine update strategy
      const existingAccount = await prisma.account.findUnique({
        where: {
          organizationId_name: {
            organizationId: user.organization.id,
            name: data.account,
          },
        },
      });

      const account = await prisma.account.upsert({
        where: {
          organizationId_name: {
            organizationId: user.organization.id,
            name: data.account,
          },
        },
        update: {
          // Only update website if provided
          ...(data.accountWebsite ? { website: data.accountWebsite } : {}),
          // Only update ticker if it's currently empty (prevent overwriting existing ticker)
          ...(data.accountTicker && !existingAccount?.ticker ? { ticker: data.accountTicker } : {}),
        },
        create: {
          name: data.account,
          website: data.accountWebsite ?? undefined,
          ticker: data.accountTicker ?? undefined,
          organizationId: user.organization.id,
          ownerId: user.id,
          priority: "medium",
          health: "good",
        },
      });
      accountId = account.id;
    }

    // Get organization's fiscal year settings to calculate quarter
    const fiscalYearStartMonth = user.organization.fiscalYearStartMonth;

    // Calculate quarter from close date if provided
    let quarter = data.quarter;
    if (data.closeDate && !quarter) {
      const closeDate = parseISODateSafe(data.closeDate);
      quarter = getQuarterFromDate(closeDate, fiscalYearStartMonth);
    }

    // Auto-assign columnId based on quarter if a matching column exists
    let columnId: string | undefined = undefined;
    if (quarter) {
      const matchingColumn = await prisma.kanbanColumn.findFirst({
        where: {
          view: {
            userId: user.id,
            isActive: true,
          },
          title: quarter,
        },
        include: {
          view: true,
        },
      });
      if (matchingColumn) {
        columnId = matchingColumn.id;
      }
    }

    // Validate ownerId if provided
    let finalOwnerId = user.id; // Default to authenticated user
    if (data.ownerId) {
      // Verify the provided ownerId exists and belongs to the same organization
      const targetOwner = await prisma.user.findUnique({
        where: { id: data.ownerId },
      });

      if (!targetOwner) {
        return NextResponse.json(
          { error: "Invalid ownerId: user does not exist" },
          { status: 400 }
        );
      }

      if (targetOwner.organizationId !== user.organization.id) {
        return NextResponse.json(
          { error: "Invalid ownerId: user is not in your organization" },
          { status: 403 }
        );
      }

      finalOwnerId = data.ownerId;
    }

    // Convert closeDate string to Date object for Prisma
    let closeDateObj: Date | undefined = undefined;
    if (data.closeDate) {
      closeDateObj = parseISODateSafe(data.closeDate);
    }

    // Convert cbc date string to Date object for Prisma
    let cbcDateObj: Date | undefined = undefined;
    if (data.cbc) {
      cbcDateObj = parseISODateSafe(data.cbc);
    }

    const createData = {
      name: data.name,
      accountName: data.account ?? undefined,
      amountArr: data.amountArr ?? 0, // Default to 0 if not provided
      confidenceLevel: data.confidenceLevel ?? 3, // Default to 3 (medium) if not provided
      nextStep: data.nextStep ?? undefined,
      cbc: cbcDateObj,
      closeDate: closeDateObj,
      quarter: quarter ?? undefined,
      columnId: columnId ?? undefined,
      stage: data.stage ?? "discovery", // Default to discovery if not provided
      forecastCategory: data.forecastCategory ?? "pipeline", // Default to pipeline if not provided
      riskNotes: data.riskNotes ?? undefined,
      notes: data.notes ?? undefined,
      accountResearch: data.accountResearch ?? undefined,
      // New fields from CSV
      decisionMakers: data.decisionMakers ?? undefined,
      competition: data.competition ?? undefined,
      legalReviewStatus: data.legalReviewStatus ?? "not_started",
      securityReviewStatus: data.securityReviewStatus ?? "not_started",
      platformType: data.platformType ?? undefined,
      businessCaseStatus: data.businessCaseStatus ?? "not_started",
      ownerId: finalOwnerId,
      organizationId: user.organization.id, // Always set to user's organization
      ...(accountId ? { accountId } : {}),
    };

    const created = await prisma.opportunity.create({
      data: createData,
      include: {
        owner: true,
        account: true,
      },
    });

    // Trigger AI research generation via Inngest background job
    // Only trigger if accountName is provided
    if (data.account) {
      // Fire-and-forget: don't await, let Inngest handle it reliably
      triggerAccountResearchGeneration({
        opportunityId: created.id,
        accountName: data.account,
        companyWebsite: data.accountWebsite,
        stage: data.stage,
        opportunityValue: data.amountArr,
      }).catch((err) => {
        // Log but don't fail the opportunity creation
        console.error("[Inngest] Failed to trigger account research:", err);
      });
    }

    const opportunity = mapPrismaOpportunityToOpportunity(created);
    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating opportunity:", error);
    return NextResponse.json({ error: "Failed to create opportunity" }, { status: 500 });
  }
}


