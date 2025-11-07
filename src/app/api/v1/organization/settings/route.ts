import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { organizationSettingsUpdateSchema } from "@/lib/validations/organization";
import { canManageOrganization } from "@/lib/permissions";

/**
 * GET /api/v1/organization/settings
 * Get organization settings
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Get organization settings
    let settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: user.organization.id },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: {
          organizationId: user.organization.id,
          allowSelfSignup: false,
          allowDomainAutoJoin: false,
        },
      });
    }

    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching organization settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/organization/settings
 * Update organization settings
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
    const parsed = organizationSettingsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Ensure settings exist
    const existingSettings = await prisma.organizationSettings.findUnique({
      where: { organizationId: user.organization.id },
    });

    let updatedSettings;

    if (existingSettings) {
      // Update existing settings
      updatedSettings = await prisma.organizationSettings.update({
        where: { organizationId: user.organization.id },
        data: {
          ...(data.defaultKanbanView !== undefined && {
            defaultKanbanView: data.defaultKanbanView,
          }),
          ...(data.defaultKanbanTemplateId !== undefined && {
            defaultKanbanTemplateId: data.defaultKanbanTemplateId,
          }),
          ...(data.allowSelfSignup !== undefined && {
            allowSelfSignup: data.allowSelfSignup,
          }),
          ...(data.allowDomainAutoJoin !== undefined && {
            allowDomainAutoJoin: data.allowDomainAutoJoin,
          }),
        },
      });
    } else {
      // Create settings if they don't exist
      updatedSettings = await prisma.organizationSettings.create({
        data: {
          organizationId: user.organization.id,
          defaultKanbanView: data.defaultKanbanView,
          defaultKanbanTemplateId: data.defaultKanbanTemplateId,
          allowSelfSignup: data.allowSelfSignup ?? false,
          allowDomainAutoJoin: data.allowDomainAutoJoin ?? false,
        },
      });
    }

    return NextResponse.json({ settings: updatedSettings }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating organization settings:", error);
    return NextResponse.json(
      { error: "Failed to update organization settings" },
      { status: 500 }
    );
  }
}
