import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encryptToken } from '@/lib/integrations/oauth-helpers';
import { exchangeCodeForTokens, SalesforceClient } from '@/lib/integrations/salesforce';

/**
 * GET /api/v1/integrations/salesforce/callback
 * Handles OAuth callback from Salesforce
 */
export async function GET(req: NextRequest) {
  try {
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Check for OAuth errors
    if (error) {
      console.error('Salesforce OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=salesforce_oauth_failed&message=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=salesforce_invalid_callback`
      );
    }

    // Parse state parameter
    let state: { organizationId: string; userId: string };
    try {
      state = JSON.parse(stateParam);
    } catch {
      console.error('Invalid state parameter');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=salesforce_invalid_state`
      );
    }

    const { organizationId, userId } = state;

    // Verify user exists and is an admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.organizationId !== organizationId || user.role !== 'ADMIN') {
      console.error('User validation failed');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=salesforce_unauthorized`
      );
    }

    // Exchange authorization code for tokens
    const { accessToken, refreshToken, instanceUrl } = await exchangeCodeForTokens(code);

    // Test the connection
    const client = new SalesforceClient(accessToken, instanceUrl, refreshToken, organizationId);
    const isConnected = await client.testConnection();

    if (!isConnected) {
      console.error('Salesforce connection test failed');
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=salesforce_connection_failed`
      );
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(accessToken);
    const encryptedRefreshToken = encryptToken(refreshToken);

    // Store or update Salesforce integration in database
    await prisma.salesforceIntegration.upsert({
      where: { organizationId },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        instanceUrl,
        isEnabled: true,
        lastSyncStatus: null,
        lastSyncError: null,
        updatedAt: new Date(),
      },
      create: {
        organizationId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        instanceUrl,
        isEnabled: true,
        syncIntervalMinutes: 60,
        syncDirection: 'bidirectional',
      },
    });

    // Redirect to settings page with success message
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?status=salesforce_connected`
    );
  } catch (error) {
    console.error('Salesforce OAuth callback error:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?error=salesforce_callback_failed`
    );
  }
}
