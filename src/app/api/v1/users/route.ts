import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

/**
 * GET /api/v1/users
 * List all users in the authenticated user's organization
 * Returns users with their roles, managers, and direct reports
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = req.nextUrl.searchParams;

    // Build where clause
    const whereClause = {
      organizationId: user.organization.id,
    };

    // Define include for user relations
    const includeRelations = {
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
    };

    const orderBy = [
      { role: "asc" as const }, // ADMIN first, then MANAGER, REP, VIEWER
      { name: "asc" as const },
    ];

    // Helper to sanitize user data
    const sanitizeUser = (
      u: Prisma.UserGetPayload<{
        include: {
          manager: { select: { id: true; name: true; email: true; avatarUrl: true } };
          directReports: { select: { id: true; name: true; email: true; avatarUrl: true } };
          _count: { select: { opportunities: true; ownedAccounts: true } };
        };
      }>
    ) => ({
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
    });

    // Detect if client wants pagination
    const usePagination = wantsPagination(searchParams);

    if (usePagination) {
      // PAGINATED MODE: Client requested pagination via query params
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 100, // Default to 100
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 100; // Ensure limit is never undefined
      const skip = (page - 1) * limit;

      // Parallel queries for performance (count total + fetch page)
      const [total, users] = await Promise.all([
        prisma.user.count({ where: whereClause }),
        prisma.user.findMany({
          where: whereClause,
          include: includeRelations,
          orderBy,
          skip,
          take: limit,
        }),
      ]);

      const sanitizedUsers = users.map(sanitizeUser);
      return cachedResponse(
        buildPaginatedResponse(sanitizedUsers, page, limit, total, 'users'),
        'frequent'
      );
    } else {
      // LEGACY MODE: No pagination params, return all users
      const users = await prisma.user.findMany({
        where: whereClause,
        include: includeRelations,
        orderBy,
      });

      const sanitizedUsers = users.map(sanitizeUser);
      return cachedResponse(
        buildLegacyResponse(sanitizedUsers, 'users'),
        'frequent'
      );
    }
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
