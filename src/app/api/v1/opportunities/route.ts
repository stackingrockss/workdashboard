import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { opportunityCreateSchema } from "@/lib/validations/opportunity";

export async function GET() {
  try {
    const opportunities = await prisma.opportunity.findMany({
      orderBy: { updatedAt: "desc" },
      include: { owner: true },
      take: 100,
    });
    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch opportunities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const createData = {
      name: data.name,
      accountName: data.account ?? undefined,
      amountArr: data.amountArr,
      probability: data.probability,
      nextStep: data.nextStep ?? undefined,
      closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
      quarter: data.quarter ?? undefined,
      stage: data.stage,
      forecastCategory: data.forecastCategory ?? undefined,
      riskNotes: data.riskNotes ?? undefined,
      notes: data.notes ?? undefined,
      ownerId: data.ownerId,
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
    console.error("Error creating opportunity:", error);
    return NextResponse.json({ error: "Failed to create opportunity" }, { status: 500 });
  }
}


