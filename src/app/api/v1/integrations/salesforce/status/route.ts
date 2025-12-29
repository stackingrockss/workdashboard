import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { createSalesforceClient } from '@/lib/integrations/salesforce';

/**
 * GET /api/v1/integrations/salesforce/status
 * Get Salesforce integration status for the organization
 */
export async function GET() {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User not found or no organization' }, { status: 404 });
    }

    // Find Salesforce integration
    const integration = await prisma.salesforceIntegration.findUnique({
      where: { organizationId: user.organizationId },
    });

    if (!integration) {
      return NextResponse.json({
        connected: false,
        isEnabled: false,
        instanceUrl: null,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        syncDirection: null,
        syncIntervalMinutes: null,
      });
    }

    // Test connection if enabled
    let connectionValid = false;
    if (integration.isEnabled) {
      try {
        const client = await createSalesforceClient(user.organizationId);
        if (client) {
          connectionValid = await client.testConnection();
        }
      } catch (error) {
        console.warn('Failed to test Salesforce connection:', error);
      }
    }

    return NextResponse.json({
      connected: true,
      isEnabled: integration.isEnabled,
      connectionValid,
      instanceUrl: integration.instanceUrl,
      lastSyncAt: integration.lastSyncAt?.toISOString() || null,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncError: integration.lastSyncError,
      syncDirection: integration.syncDirection,
      syncIntervalMinutes: integration.syncIntervalMinutes,
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Salesforce status error:', error);
    return NextResponse.json(
      { error: 'Failed to get Salesforce status' },
      { status: 500 }
    );
  }
}
