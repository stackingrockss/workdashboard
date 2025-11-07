import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// DELETE /api/v1/opportunities/[id]/gong-calls/[callId] - Delete a specific Gong call
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; callId: string }> }
) {
  const { callId } = await params;
  try {
    await prisma.gongCall.delete({
      where: { id: callId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete Gong call" }, { status: 500 });
  }
}
