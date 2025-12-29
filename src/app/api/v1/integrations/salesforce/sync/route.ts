import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { inngest } from '@/lib/inngest/client';

/**
 * POST /api/v1/integrations/salesforce/sync
 * Trigger a manual sync of Salesforce data for the organization
 * Requires: ADMIN role
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins can trigger syncs
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Only administrators can trigger Salesforce sync' },
        { status: 403 }
      );
    }

    // Check if integration exists and is enabled
    const integration = await prisma.salesforceIntegration.findUnique({
      where: { organizationId: user.organization.id },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Salesforce integration not configured' },
        { status: 400 }
      );
    }

    if (!integration.isEnabled) {
      return NextResponse.json(
        { error: 'Salesforce integration is disabled' },
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
    await prisma.salesforceIntegration.update({
      where: { organizationId: user.organization.id },
      data: {
        lastSyncStatus: 'in_progress',
        lastSyncError: null,
      },
    });

    // Send Inngest event to trigger sync
    await inngest.send({
      name: 'salesforce/sync.manual',
      data: {
        organizationId: user.organization.id,
        triggeredBy: user.id,
        fullSync,
        direction: integration.syncDirection,
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
    console.error('Failed to trigger Salesforce sync:', error);

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
 * GET /api/v1/integrations/salesforce/sync
 * Get sync status and statistics
 * Requires: Authentication (any role)
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const integration = await prisma.salesforceIntegration.findUnique({
      where: { organizationId: user.organization.id },
      select: {
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
        syncCursor: true,
        isEnabled: true,
        syncDirection: true,
        syncIntervalMinutes: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Salesforce integration not configured' },
        { status: 404 }
      );
    }

    // Get counts of synced records
    const [accountCount, contactCount, opportunityCount] = await Promise.all([
      prisma.account.count({
        where: {
          organizationId: user.organization.id,
          salesforceId: { not: null },
        },
      }),
      prisma.contact.count({
        where: {
          salesforceId: { not: null },
          account: { organizationId: user.organization.id },
        },
      }),
      prisma.opportunity.count({
        where: {
          organizationId: user.organization.id,
          salesforceId: { not: null },
        },
      }),
    ]);

    return NextResponse.json({
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncError: integration.lastSyncError,
      isEnabled: integration.isEnabled,
      syncDirection: integration.syncDirection,
      syncIntervalMinutes: integration.syncIntervalMinutes,
      syncedCounts: {
        accounts: accountCount,
        contacts: contactCount,
        opportunities: opportunityCount,
      },
      hasSyncCursor: !!integration.syncCursor,
    });
  } catch (error) {
    console.error('Failed to get Salesforce sync status:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
