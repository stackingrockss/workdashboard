import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

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
