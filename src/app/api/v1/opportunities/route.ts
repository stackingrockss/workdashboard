import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { opportunityCreateSchema } from "@/lib/validations/opportunity";
import { requireAuth } from "@/lib/auth";
import { getQuarterFromDate } from "@/lib/utils/quarter";

export async function GET() {
  try {
    const user = await requireAuth();

    const opportunities = await prisma.opportunity.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: true,
        account: true,
      },
      take: 100,
    });
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

    // Get user's fiscal year settings to calculate quarter
    const settings = await prisma.companySettings.findUnique({
      where: { userId: user.id },
    });
    const fiscalYearStartMonth = settings?.fiscalYearStartMonth ?? 1;

    // Calculate quarter from close date if provided
    let quarter = data.quarter;
    if (data.closeDate && !quarter) {
      const closeDate = new Date(data.closeDate);
      quarter = getQuarterFromDate(closeDate, fiscalYearStartMonth);
    }

    const createData = {
      name: data.name,
      accountName: data.account ?? undefined,
      amountArr: data.amountArr ?? 0, // Default to 0 if not provided
      probability: data.probability ?? 10, // Default to 10% if not provided
      nextStep: data.nextStep ?? undefined,
      closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
      quarter: quarter ?? undefined,
      stage: data.stage ?? "discovery", // Default to discovery if not provided
      forecastCategory: data.forecastCategory ?? "pipeline", // Default to pipeline if not provided
      riskNotes: data.riskNotes ?? undefined,
      notes: data.notes ?? undefined,
      accountResearch: data.accountResearch ?? undefined,
      ownerId: data.ownerId ?? user.id, // Use provided ownerId or default to authenticated user's ID
      ...(accountId ? { accountId } : {}),
    };

    const created = await prisma.opportunity.create({
      data: createData,
      include: {
        owner: true,
        account: true,
      },
    });
    return NextResponse.json({ opportunity: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating opportunity:", error);
    return NextResponse.json({ error: "Failed to create opportunity" }, { status: 500 });
  }
}


