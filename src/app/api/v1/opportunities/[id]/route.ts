import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { opportunityUpdateSchema } from "@/lib/validations/opportunity";

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
    const json = await req.json();
    const parsed = opportunityUpdateSchema.safeParse(json);
    if (!parsed.success) {
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

    const updateData: Record<string, unknown> = {
      name: data.name ?? undefined,
      accountName: data.account ?? undefined,
      amountArr: data.amountArr ?? undefined,
      probability: data.probability ?? undefined,
      nextStep: data.nextStep ?? undefined,
      closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
      quarter: data.quarter ?? undefined,
      stage: data.stage ?? undefined,
      forecastCategory: data.forecastCategory ?? undefined,
      riskNotes: data.riskNotes ?? undefined,
      notes: data.notes ?? undefined,
      owner: data.ownerId ? { connect: { id: data.ownerId } } : undefined,
    };

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


