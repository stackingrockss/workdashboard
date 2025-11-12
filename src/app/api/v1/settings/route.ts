import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/v1/settings
 * Get user and organization settings
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user settings with organization info
    const userWithOrg = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            fiscalYearStartMonth: true,
          },
        },
      },
    });

    if (!userWithOrg || !userWithOrg.organization) {
      return NextResponse.json({ error: "User or organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: userWithOrg.id,
        name: userWithOrg.name,
        email: userWithOrg.email,
        role: userWithOrg.role,
      },
      organization: userWithOrg.organization,
    });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}
