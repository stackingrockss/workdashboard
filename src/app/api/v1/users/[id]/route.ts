import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validations/user";
import { canManageUsers, isAdmin } from "@/lib/permissions";

/**
 * GET /api/v1/users/[id]
 * Get a specific user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Get the requested user
    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        organizationId: user.organization.id, // Must be in same org
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
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Sanitize response
    const sanitizedUser = {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      avatarUrl: targetUser.avatarUrl,
      role: targetUser.role,
      managerId: targetUser.managerId,
      manager: targetUser.manager,
      directReports: targetUser.directReports,
      opportunityCount: targetUser._count.opportunities,
      accountCount: targetUser._count.ownedAccounts,
      createdAt: targetUser.createdAt.toISOString(),
    };

    return NextResponse.json({ user: sanitizedUser }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/users/[id]
 * Update a user's role or manager
 * Only ADMIN can update roles
 * ADMIN and MANAGER can assign managers
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Check permission to manage users
    if (!canManageUsers(user)) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to manage users" },
        { status: 403 }
      );
    }

    // Get the target user
    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = userUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Only ADMIN can change roles
    if (data.role !== undefined && !isAdmin(user)) {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN can change user roles" },
        { status: 403 }
      );
    }

    // Prevent users from changing their own role (security measure)
    if (data.role !== undefined && targetUser.id === user.id) {
      return NextResponse.json(
        { error: "Forbidden: Cannot change your own role" },
        { status: 403 }
      );
    }

    // If managerId is provided, verify it's a valid user in the org
    if (data.managerId !== undefined && data.managerId !== null) {
      const managerExists = await prisma.user.findFirst({
        where: {
          id: data.managerId,
          organizationId: user.organization.id,
        },
      });

      if (!managerExists) {
        return NextResponse.json(
          { error: "Manager not found in organization" },
          { status: 400 }
        );
      }

      // Prevent circular manager relationships
      if (data.managerId === targetUser.id) {
        return NextResponse.json(
          { error: "User cannot be their own manager" },
          { status: 400 }
        );
      }
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(data.role !== undefined && { role: data.role }),
        ...(data.managerId !== undefined && {
          managerId: data.managerId,
        }),
        ...(data.name !== undefined && { name: data.name }),
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
      },
    });

    // Sanitize response
    const sanitizedUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatarUrl: updatedUser.avatarUrl,
      role: updatedUser.role,
      managerId: updatedUser.managerId,
      manager: updatedUser.manager,
      directReports: updatedUser.directReports,
    };

    return NextResponse.json({ user: sanitizedUser }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/users/[id]
 * Delete a user from the organization
 * Only ADMIN can delete users
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Only ADMIN can delete users
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN can delete users" },
        { status: 403 }
      );
    }

    // Get the target user
    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent users from deleting themselves
    if (targetUser.id === user.id) {
      return NextResponse.json(
        { error: "Forbidden: Cannot delete your own account" },
        { status: 403 }
      );
    }

    // Check if user has opportunities or accounts
    const opportunityCount = await prisma.opportunity.count({
      where: { ownerId: id },
    });

    const accountCount = await prisma.account.count({
      where: { ownerId: id },
    });

    if (opportunityCount > 0 || accountCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete user: ${opportunityCount} opportunities and ${accountCount} accounts must be reassigned first`,
          opportunityCount,
          accountCount,
        },
        { status: 400 }
      );
    }

    // Delete the user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
