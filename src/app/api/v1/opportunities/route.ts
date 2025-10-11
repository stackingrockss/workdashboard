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
    const created = await prisma.opportunity.create({
      data: {
        name: data.name,
        account: data.account,
        amountArr: data.amountArr,
        probability: data.probability,
        nextStep: data.nextStep ?? undefined,
        closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
        stage: data.stage,
        owner: { connect: { id: data.ownerId } },
      },
      include: { owner: true },
    });
    return NextResponse.json({ opportunity: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create opportunity" }, { status: 500 });
  }
}


