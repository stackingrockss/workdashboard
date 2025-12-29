import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for settings update
const updateSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  syncDirection: z.enum(['import_only', 'export_only', 'bidirectional']).optional(),
  syncIntervalMinutes: z.number().min(15).max(1440).optional(), // 15 min to 24 hours
});

/**
 * GET /api/v1/integrations/salesforce/settings
 * Get Salesforce integration settings
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
      return NextResponse.json(
        { error: 'Salesforce integration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      isEnabled: integration.isEnabled,
      syncDirection: integration.syncDirection,
      syncIntervalMinutes: integration.syncIntervalMinutes,
      instanceUrl: integration.instanceUrl,
      lastSyncAt: integration.lastSyncAt?.toISOString() || null,
      lastSyncStatus: integration.lastSyncStatus,
      syncCursor: integration.syncCursor?.toISOString() || null,
    });
  } catch (error) {
    console.error('Salesforce settings GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get Salesforce settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/integrations/salesforce/settings
 * Update Salesforce integration settings
 */
export async function PATCH(req: NextRequest) {
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

    // Check if user has permission (only ADMIN can update settings)
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can update Salesforce settings' },
        { status: 403 }
      );
    }

    // Find existing integration
    const integration = await prisma.salesforceIntegration.findUnique({
      where: { organizationId: user.organizationId },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Salesforce integration not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = updateSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid settings', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { isEnabled, syncDirection, syncIntervalMinutes } = validationResult.data;

    // Update settings
    const updated = await prisma.salesforceIntegration.update({
      where: { organizationId: user.organizationId },
      data: {
        ...(isEnabled !== undefined && { isEnabled }),
        ...(syncDirection !== undefined && { syncDirection }),
        ...(syncIntervalMinutes !== undefined && { syncIntervalMinutes }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      isEnabled: updated.isEnabled,
      syncDirection: updated.syncDirection,
      syncIntervalMinutes: updated.syncIntervalMinutes,
    });
  } catch (error) {
    console.error('Salesforce settings PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update Salesforce settings' },
      { status: 500 }
    );
  }
}
