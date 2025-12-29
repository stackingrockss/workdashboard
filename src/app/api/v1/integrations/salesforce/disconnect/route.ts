import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { decryptToken } from '@/lib/integrations/oauth-helpers';
import { revokeSalesforceTokens } from '@/lib/integrations/salesforce';

/**
 * DELETE /api/v1/integrations/salesforce/disconnect
 * Disconnects Salesforce integration and revokes tokens
 */
export async function DELETE() {
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

    // Check if user has permission (only ADMIN can disconnect integrations)
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can disconnect Salesforce' },
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

    // Try to revoke tokens (best effort)
    try {
      const accessToken = decryptToken(integration.accessToken);
      await revokeSalesforceTokens(accessToken, integration.instanceUrl);
    } catch (error) {
      console.warn('Failed to revoke Salesforce tokens:', error);
      // Continue with deletion anyway
    }

    // Delete the integration record
    await prisma.salesforceIntegration.delete({
      where: { organizationId: user.organizationId },
    });

    return NextResponse.json({ success: true, message: 'Salesforce disconnected' });
  } catch (error) {
    console.error('Salesforce disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Salesforce' },
      { status: 500 }
    );
  }
}
