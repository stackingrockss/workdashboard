import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { organizationUpdateSchema } from "@/lib/validations/organization";
import { canManageOrganization } from "@/lib/permissions";

/**
 * GET /api/v1/organization
 * Get the authenticated user's organization details and settings
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Get organization with settings
    const organization = await prisma.organization.findUnique({
      where: { id: user.organization.id },
      include: {
        settings: true,
        _count: {
          select: {
            users: true,
            opportunities: true,
            accounts: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        organization: {
          id: organization.id,
          name: organization.name,
          domain: organization.domain,
          logo: organization.logo,
          fiscalYearStartMonth: organization.fiscalYearStartMonth,
          createdAt: organization.createdAt.toISOString(),
          updatedAt: organization.updatedAt.toISOString(),
          settings: organization.settings,
          userCount: organization._count.users,
          opportunityCount: organization._count.opportunities,
          accountCount: organization._count.accounts,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/organization
 * Update organization details and settings
 * Only ADMIN can update organization settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check permission to manage organization
    if (!canManageOrganization(user)) {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN can update organization settings" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = organizationUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If domain is being changed, verify it's not already in use
    if (data.domain !== undefined && data.domain !== null) {
      const existingOrg = await prisma.organization.findFirst({
        where: {
          domain: data.domain.toLowerCase(),
          id: { not: user.organization.id },
        },
      });

      if (existingOrg) {
        return NextResponse.json(
          { error: "This domain is already in use by another organization" },
          { status: 400 }
        );
      }
    }

    // Update organization
    const updatedOrganization = await prisma.organization.update({
      where: { id: user.organization.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.domain !== undefined && {
          domain: data.domain ? data.domain.toLowerCase() : null,
        }),
        ...(data.logo !== undefined && { logo: data.logo }),
        ...(data.fiscalYearStartMonth !== undefined && {
          fiscalYearStartMonth: data.fiscalYearStartMonth,
        }),
      },
      include: {
        settings: true,
      },
    });

    return NextResponse.json(
      {
        organization: {
          id: updatedOrganization.id,
          name: updatedOrganization.name,
          domain: updatedOrganization.domain,
          logo: updatedOrganization.logo,
          fiscalYearStartMonth: updatedOrganization.fiscalYearStartMonth,
          settings: updatedOrganization.settings,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}
