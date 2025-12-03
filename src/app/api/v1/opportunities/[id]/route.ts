import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { opportunityUpdateSchema } from "@/lib/validations/opportunity";
import { requireAuth } from "@/lib/auth";
import { getQuarterFromDate, parseISODateSafe } from "@/lib/utils/quarter";
import { getDefaultConfidenceLevel, getDefaultForecastCategory, OpportunityStage } from "@/types/opportunity";
import { mapPrismaOpportunityToOpportunity } from "@/lib/mappers/opportunity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    const opportunityFromDB = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id, // Security: scope to user's organization
      },
      include: {
        owner: true,
        account: true,
        granolaNotes: {
          orderBy: {
            createdAt: "desc",
          },
        },
        gongCalls: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
    if (!opportunityFromDB) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const opportunity = mapPrismaOpportunityToOpportunity(opportunityFromDB);
    return NextResponse.json({ opportunity });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch opportunity" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = opportunityUpdateSchema.safeParse(json);
    if (!parsed.success) {
      const errors = parsed.error.flatten();
      console.error(`[PATCH /api/v1/opportunities/${id}] Validation failed:`, {
        input: json,
        errors,
      });

      // Create a user-friendly error message
      const fieldErrors = errors.fieldErrors;
      let errorMessage = "Validation failed";

      if (fieldErrors.accountResearch) {
        errorMessage = `Account research validation failed: ${fieldErrors.accountResearch[0]}`;
      } else if (Object.keys(fieldErrors).length > 0) {
        const firstError = Object.entries(fieldErrors)[0];
        errorMessage = `${firstError[0]}: ${firstError[1]?.[0]}`;
      }

      return NextResponse.json({ error: errorMessage, details: errors }, { status: 400 });
    }
    const data = parsed.data;

    // If account name is provided instead of accountId, find or create the account
    let accountId = data.accountId;
    if (data.account && !accountId) {
      // Normalize account name (trim whitespace)
      const normalizedAccountName = data.account.trim();

      // First check if account exists (case-insensitive) to determine update strategy
      const existingAccount = await prisma.account.findFirst({
        where: {
          organizationId: user.organization.id,
          name: {
            equals: normalizedAccountName,
            mode: "insensitive",
          },
        },
      });

      if (existingAccount) {
        // Account exists, update it if needed
        const account = await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            // Only update website if provided
            ...(data.accountWebsite ? { website: data.accountWebsite } : {}),
            // Only update ticker if it's currently empty (prevent overwriting existing ticker)
            ...(data.accountTicker && !existingAccount.ticker ? { ticker: data.accountTicker } : {}),
          },
        });
        accountId = account.id;
      } else {
        // Create new account
        const account = await prisma.account.create({
          data: {
            name: normalizedAccountName,
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
    }

    // Security: Verify opportunity belongs to user's organization before updating
    const existingOpportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!existingOpportunity) {
      // Check if opportunity exists at all (for debugging)
      const anyOpportunity = await prisma.opportunity.findUnique({
        where: { id },
        select: { id: true, organizationId: true },
      });

      if (anyOpportunity) {
        console.error(`[PATCH /api/v1/opportunities/${id}] Organization mismatch:`, {
          opportunityOrgId: anyOpportunity.organizationId,
          userOrgId: user.organization.id,
          userId: user.id,
        });
      } else {
        console.error(`[PATCH /api/v1/opportunities/${id}] Opportunity does not exist in database`);
      }

      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Only include fields that are explicitly provided
    if (data.name !== undefined) updateData.name = data.name;
    if (data.account !== undefined) updateData.accountName = data.account;
    if (data.amountArr !== undefined) updateData.amountArr = data.amountArr;
    if (data.confidenceLevel !== undefined) updateData.confidenceLevel = data.confidenceLevel;
    if (data.nextStep !== undefined) updateData.nextStep = data.nextStep;
    if (data.cbc !== undefined) {
      // Convert cbc date string to Date object for Prisma
      const cbcDateObj = data.cbc ? parseISODateSafe(data.cbc) : null;
      updateData.cbc = cbcDateObj;
    }
    if (data.nextCallDate !== undefined) {
      // Convert nextCallDate string to Date object for Prisma
      updateData.nextCallDate = data.nextCallDate ? new Date(data.nextCallDate) : null;
      updateData.nextCallDateSource = 'manual';
      updateData.nextCallDateManuallySet = true;
      updateData.nextCallDateLastCalculated = new Date();
      updateData.nextCallDateEventId = null; // Clear event reference for manual dates
    }
    if (data.closeDate !== undefined) {
      // Convert closeDate string to Date object for Prisma
      const closeDateObj = data.closeDate ? parseISODateSafe(data.closeDate) : null;
      updateData.closeDate = closeDateObj;

      // Recalculate quarter when close date changes
      if (data.closeDate) {
        const fiscalYearStartMonth = user.organization?.fiscalYearStartMonth ?? 1;
        const newQuarter = getQuarterFromDate(closeDateObj!, fiscalYearStartMonth);
        updateData.quarter = newQuarter;

        // Auto-assign columnId based on new quarter
        const matchingColumn = await prisma.kanbanColumn.findFirst({
          where: {
            view: {
              userId: user.id,
              isActive: true,
            },
            title: newQuarter,
          },
        });
        if (matchingColumn) {
          updateData.columnId = matchingColumn.id;
        }
      } else {
        updateData.quarter = null;
        updateData.columnId = null;
      }
    }
    if (data.quarter !== undefined && data.closeDate === undefined) {
      // Only update quarter directly if closeDate is not being updated
      updateData.quarter = data.quarter;

      // Also update columnId to match the quarter
      if (data.quarter) {
        const matchingColumn = await prisma.kanbanColumn.findFirst({
          where: {
            view: {
              userId: user.id,
              isActive: true,
            },
            title: data.quarter,
          },
        });
        if (matchingColumn) {
          updateData.columnId = matchingColumn.id;
        }
      }
    }
    if (data.stage !== undefined) {
      updateData.stage = data.stage;

      // Auto-update confidenceLevel if not explicitly provided
      if (data.confidenceLevel === undefined) {
        updateData.confidenceLevel = getDefaultConfidenceLevel(data.stage as OpportunityStage);
      }

      // Auto-update forecastCategory if not explicitly provided
      if (data.forecastCategory === undefined) {
        updateData.forecastCategory = getDefaultForecastCategory(data.stage as OpportunityStage);
      }
    }
    if (data.columnId !== undefined) updateData.columnId = data.columnId;
    if (data.forecastCategory !== undefined) updateData.forecastCategory = data.forecastCategory;
    if (data.riskNotes !== undefined) updateData.riskNotes = data.riskNotes;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.accountResearch !== undefined) updateData.accountResearch = data.accountResearch;
    // New fields from CSV
    if (data.decisionMakers !== undefined) updateData.decisionMakers = data.decisionMakers;
    if (data.competition !== undefined) updateData.competition = data.competition;
    if (data.legalReviewStatus !== undefined) updateData.legalReviewStatus = data.legalReviewStatus;
    if (data.securityReviewStatus !== undefined) updateData.securityReviewStatus = data.securityReviewStatus;
    if (data.platformType !== undefined) updateData.platformType = data.platformType;
    if (data.businessCaseStatus !== undefined) updateData.businessCaseStatus = data.businessCaseStatus;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.pinnedToWhiteboard !== undefined) updateData.pinnedToWhiteboard = data.pinnedToWhiteboard;
    // Call history fields (manually editable)
    if (data.painPointsHistory !== undefined) updateData.painPointsHistory = data.painPointsHistory;
    if (data.goalsHistory !== undefined) updateData.goalsHistory = data.goalsHistory;
    if (data.nextStepsHistory !== undefined) updateData.nextStepsHistory = data.nextStepsHistory;
    // Business case content fields
    if (data.businessCaseContent !== undefined) updateData.businessCaseContent = data.businessCaseContent;
    if (data.businessCaseQuestions !== undefined) updateData.businessCaseQuestions = data.businessCaseQuestions;
    if (accountId) {
      updateData.accountId = accountId;
    }

    const updated = await prisma.opportunity.update({
      where: { id },
      data: updateData,
      include: {
        owner: true,
        account: true,
      },
    });
    const opportunity = mapPrismaOpportunityToOpportunity(updated);
    return NextResponse.json({ opportunity });
  } catch (error) {
    console.error(`[PATCH /api/v1/opportunities/${id}] Error:`, error);
    return NextResponse.json({ error: "Failed to update opportunity" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    // Security: Verify opportunity belongs to user's organization before deleting
    const existingOpportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!existingOpportunity) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.opportunity.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete opportunity" }, { status: 500 });
  }
}


