import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { encryptToken, decryptToken } from '@/lib/integrations/oauth-helpers';
import { gongIntegrationCreateSchema } from '@/lib/validations/gong-integration';
import { createGongClient } from '@/lib/integrations/gong';

/**
 * GET /api/v1/integrations/gong
 * Returns Gong integration status for the current organization
 * Requires: Authentication (any role)
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const integration = await prisma.gongIntegration.findUnique({
      where: { organizationId: user.organization.id },
    });

    if (!integration) {
      return NextResponse.json({
        connected: false,
        isEnabled: false,
      });
    }

    return NextResponse.json({
      connected: true,
      isEnabled: integration.isEnabled,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncError: integration.lastSyncError,
      syncIntervalMinutes: integration.syncIntervalMinutes,
    });
  } catch (error) {
    console.error('Failed to get Gong integration status:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to get integration status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/integrations/gong
 * Create or update Gong integration credentials
 * Requires: ADMIN role
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins can manage integrations
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Only administrators can manage Gong integration' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = gongIntegrationCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { accessKey, accessKeySecret } = parsed.data;

    // Test credentials before saving
    const client = createGongClient(accessKey, accessKeySecret);
    const isValid = await client.testConnection();

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Gong credentials. Please check your Access Key and Access Key Secret.' },
        { status: 400 }
      );
    }

    // Encrypt credentials
    const encryptedAccessKey = encryptToken(accessKey);
    const encryptedAccessKeySecret = encryptToken(accessKeySecret);

    // Upsert integration
    const integration = await prisma.gongIntegration.upsert({
      where: { organizationId: user.organization.id },
      update: {
        accessKey: encryptedAccessKey,
        accessKeySecret: encryptedAccessKeySecret,
        isEnabled: true,
        lastSyncStatus: null,
        lastSyncError: null,
      },
      create: {
        organizationId: user.organization.id,
        accessKey: encryptedAccessKey,
        accessKeySecret: encryptedAccessKeySecret,
        isEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      connected: true,
      isEnabled: integration.isEnabled,
      message: 'Gong integration connected successfully',
    });
  } catch (error) {
    console.error('Failed to create/update Gong integration:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to save Gong integration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/integrations/gong
 * Disconnect Gong integration
 * Requires: ADMIN role
 */
export async function DELETE() {
  try {
    const user = await requireAuth();

    // Only admins can manage integrations
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Only administrators can manage Gong integration' },
        { status: 403 }
      );
    }

    // Delete integration record
    await prisma.gongIntegration.delete({
      where: { organizationId: user.organization.id },
    });

    return NextResponse.json({
      success: true,
      connected: false,
      message: 'Gong integration disconnected',
    });
  } catch (error) {
    console.error('Failed to disconnect Gong integration:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle case where integration doesn't exist
    if (
      error instanceof Error &&
      error.message.includes('Record to delete does not exist')
    ) {
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'Gong integration not found',
      });
    }

    return NextResponse.json(
      { error: 'Failed to disconnect Gong integration' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/integrations/gong
 * Update Gong integration settings (enable/disable, sync interval)
 * Requires: ADMIN role
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins can manage integrations
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Only administrators can manage Gong integration' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { isEnabled, syncIntervalMinutes } = body;

    // Validate sync interval if provided
    if (
      syncIntervalMinutes !== undefined &&
      (syncIntervalMinutes < 15 || syncIntervalMinutes > 1440)
    ) {
      return NextResponse.json(
        { error: 'Sync interval must be between 15 minutes and 24 hours' },
        { status: 400 }
      );
    }

    const updateData: { isEnabled?: boolean; syncIntervalMinutes?: number } = {};
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (syncIntervalMinutes !== undefined) updateData.syncIntervalMinutes = syncIntervalMinutes;

    const integration = await prisma.gongIntegration.update({
      where: { organizationId: user.organization.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      isEnabled: integration.isEnabled,
      syncIntervalMinutes: integration.syncIntervalMinutes,
    });
  } catch (error) {
    console.error('Failed to update Gong integration:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to update Gong integration' },
      { status: 500 }
    );
  }
}
