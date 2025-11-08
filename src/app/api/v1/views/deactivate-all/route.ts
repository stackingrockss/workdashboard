/**
 * API Route: /api/v1/views/deactivate-all
 * Deactivates all custom views for the authenticated user
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/v1/views/deactivate-all
 * Deactivate all custom views for the authenticated user
 */
export async function POST() {
  try {
    // Require authentication
    const user = await requireAuth();

    // Deactivate all views for this user
    await prisma.kanbanView.updateMany({
      where: {
        userId: user.id,
      },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deactivating views:", error);
    return NextResponse.json({ error: "Failed to deactivate views" }, { status: 500 });
  }
}
