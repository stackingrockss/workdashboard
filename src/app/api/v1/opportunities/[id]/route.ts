import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { opportunityUpdateSchema } from "@/lib/validations/opportunity";
import { requireAuth } from "@/lib/auth";
import { getQuarterFromDate } from "@/lib/utils/quarter";
import { getDefaultProbability, getDefaultForecastCategory, OpportunityStage } from "@/types/opportunity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
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
    if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ opportunity });
  } catch (error) {
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
      console.error(`[PATCH /api/v1/opportunities/${id}] Validation failed:`, {
        input: json,
        errors: parsed.error.flatten(),
      });
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // If account name is provided instead of accountId, find or create the account
    let accountId = data.accountId;
    if (data.account && !accountId) {
      const account = await prisma.account.upsert({
        where: { name: data.account },
        update: {},
        create: {
          name: data.account,
          priority: "medium",
          health: "good",
        },
      });
      accountId = account.id;
    }

    const updateData: Record<string, unknown> = {};

    // Only include fields that are explicitly provided
    if (data.name !== undefined) updateData.name = data.name;
    if (data.account !== undefined) updateData.accountName = data.account;
    if (data.amountArr !== undefined) updateData.amountArr = data.amountArr;
    if (data.probability !== undefined) updateData.probability = data.probability;
    if (data.nextStep !== undefined) updateData.nextStep = data.nextStep;
    if (data.closeDate !== undefined) {
      updateData.closeDate = data.closeDate ? new Date(data.closeDate) : null;

      // Recalculate quarter when close date changes
      if (data.closeDate) {
        const settings = await prisma.companySettings.findUnique({
          where: { userId: user.id },
        });
        const fiscalYearStartMonth = settings?.fiscalYearStartMonth ?? 1;
        const closeDate = new Date(data.closeDate);
        const newQuarter = getQuarterFromDate(closeDate, fiscalYearStartMonth);
        updateData.quarter = newQuarter;

        // Auto-assign columnId based on new quarter
        const matchingColumn = await prisma.kanbanColumn.findFirst({
          where: {
            userId: user.id,
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
            userId: user.id,
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

      // Auto-update probability if not explicitly provided
      if (data.probability === undefined) {
        updateData.probability = getDefaultProbability(data.stage as OpportunityStage);
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
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
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
    return NextResponse.json({ opportunity: updated });
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
    await prisma.opportunity.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete opportunity" }, { status: 500 });
  }
}


