import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { getAuthorizationUrl } from '@/lib/integrations/salesforce';

/**
 * GET /api/v1/integrations/salesforce/auth
 * Initiates Salesforce OAuth flow
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

    // Check if user has permission (only ADMIN can connect integrations)
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can connect Salesforce' },
        { status: 403 }
      );
    }

    // Verify environment variables
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
    const redirectUri = process.env.SALESFORCE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Salesforce OAuth credentials not configured');
      return NextResponse.json(
        { error: 'Salesforce OAuth not configured' },
        { status: 500 }
      );
    }

    // Create state parameter with organizationId for verification in callback
    const state = JSON.stringify({
      organizationId: user.organizationId,
      userId: user.id,
    });

    // Generate authorization URL
    const authUrl = getAuthorizationUrl(state);

    // Redirect to Salesforce OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Salesforce OAuth authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
