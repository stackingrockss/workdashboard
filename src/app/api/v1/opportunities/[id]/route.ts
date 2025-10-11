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
      include: { owner: true },
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
    const updated = await prisma.opportunity.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        account: data.account ?? undefined,
        amountArr: data.amountArr ?? undefined,
        probability: data.probability ?? undefined,
        nextStep: data.nextStep ?? undefined,
        closeDate: data.closeDate ? new Date(data.closeDate) : undefined,
        stage: data.stage ?? undefined,
        owner: data.ownerId ? { connect: { id: data.ownerId } } : undefined,
      },
      include: { owner: true },
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


