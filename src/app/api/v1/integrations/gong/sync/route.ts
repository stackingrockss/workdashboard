import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { inngest } from '@/lib/inngest/client';

/**
 * POST /api/v1/integrations/gong/sync
 * Trigger a manual sync of Gong calls for the organization
 * Requires: ADMIN role
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins can trigger syncs
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Only administrators can trigger Gong sync' },
        { status: 403 }
      );
    }

    // Check if integration exists and is enabled
    const integration = await prisma.gongIntegration.findUnique({
      where: { organizationId: user.organization.id },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Gong integration not configured' },
        { status: 400 }
      );
    }

    if (!integration.isEnabled) {
      return NextResponse.json(
        { error: 'Gong integration is disabled' },
        { status: 400 }
      );
    }

    // Check if a sync is already in progress
    if (integration.lastSyncStatus === 'in_progress') {
      return NextResponse.json(
        {
          error: 'A sync is already in progress',
          lastSyncAt: integration.lastSyncAt,
        },
        { status: 409 }
      );
    }

    // Parse optional body params
    let fullSync = false;
    try {
      const body = await request.json();
      fullSync = body.fullSync === true;
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Update status to in_progress
    await prisma.gongIntegration.update({
      where: { organizationId: user.organization.id },
      data: {
        lastSyncStatus: 'in_progress',
        lastSyncError: null,
      },
    });

    // Send Inngest event to trigger sync
    await inngest.send({
      name: 'gong/sync.manual',
      data: {
        organizationId: user.organization.id,
        triggeredBy: user.id,
        fullSync,
      },
    });

    return NextResponse.json({
      success: true,
      message: fullSync
        ? 'Full sync started - this may take several minutes'
        : 'Incremental sync started',
      status: 'in_progress',
    });
  } catch (error) {
    console.error('Failed to trigger Gong sync:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/integrations/gong/sync
 * Get sync status and history
 * Requires: Authentication (any role)
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const integration = await prisma.gongIntegration.findUnique({
      where: { organizationId: user.organization.id },
      select: {
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
        syncCursor: true,
        isEnabled: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Gong integration not configured' },
        { status: 404 }
      );
    }

    // Get count of synced calls
    const syncedCallCount = await prisma.gongCall.count({
      where: {
        organizationId: user.organization.id,
        gongCallId: { not: null },
      },
    });

    return NextResponse.json({
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncError: integration.lastSyncError,
      isEnabled: integration.isEnabled,
      syncedCallCount,
      hasSyncCursor: !!integration.syncCursor,
    });
  } catch (error) {
    console.error('Failed to get sync status:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
