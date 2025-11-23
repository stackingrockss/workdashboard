import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { gongCallUpdateSchema } from "@/lib/validations/gong-call";
import { requireAuth } from "@/lib/auth";

// PATCH /api/v1/opportunities/[id]/gong-calls/[callId] - Update a Gong call (e.g., link/unlink from calendar event)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; callId: string }> }
) {
  const { id, callId } = await params;
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = gongCallUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify opportunity exists and belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Verify Gong call exists and belongs to this opportunity
    const existingCall = await prisma.gongCall.findFirst({
      where: {
        id: callId,
        opportunityId: id,
      },
    });

    if (!existingCall) {
      return NextResponse.json({ error: "Gong call not found" }, { status: 404 });
    }

    // Update the Gong call
    const updatedCall = await prisma.gongCall.update({
      where: { id: callId },
      data: parsed.data,
    });

    // Revalidate the opportunity detail page
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ call: updatedCall });
  } catch (error) {
    console.error('Failed to update Gong call:', error);
    return NextResponse.json({ error: "Failed to update Gong call" }, { status: 500 });
  }
}

// DELETE /api/v1/opportunities/[id]/gong-calls/[callId] - Delete a specific Gong call
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; callId: string }> }
) {
  const { id, callId } = await params;
  try {
    await prisma.gongCall.delete({
      where: { id: callId },
    });

    // Revalidate the opportunity detail page to reflect deletion immediately
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete Gong call" }, { status: 500 });
  }
}
