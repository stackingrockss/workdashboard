import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/v1/users
 * List all users in the authenticated user's organization
 * Returns users with their roles, managers, and direct reports
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Get all users in the organization
    const users = await prisma.user.findMany({
      where: {
        organizationId: user.organization.id,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        directReports: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            opportunities: true,
            ownedAccounts: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // ADMIN first, then MANAGER, REP, VIEWER
        { name: "asc" },
      ],
    });

    // Transform to remove sensitive data based on permissions
    const sanitizedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      role: u.role,
      managerId: u.managerId,
      manager: u.manager,
      directReports: u.directReports,
      opportunityCount: u._count.opportunities,
      accountCount: u._count.ownedAccounts,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({ users: sanitizedUsers }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
