// src/app/api/v1/users/me/route.ts
// Returns current authenticated user's basic information including Prisma user ID

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { logError } from "@/lib/errors";

/**
 * GET /api/v1/users/me
 * Returns the current user's basic profile information
 */
export async function GET() {
  try {
    const user = await requireAuth();

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      organizationId: user.organization.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logError("fetch-current-user", error);
    return NextResponse.json(
      { error: "Failed to fetch user information" },
      { status: 500 }
    );
  }
}
