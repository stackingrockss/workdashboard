import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { google } from 'googleapis';
import { getValidAccessToken } from '@/lib/integrations/oauth-helpers';

/**
 * GET /api/v1/integrations/google/status
 * Returns connection status for Google Calendar
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find the OAuth token
    const token = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google',
        },
      },
    });

    if (!token) {
      return NextResponse.json({
        connected: false,
      });
    }

    // Try to get user's email from Google
    let email: string | undefined;
    try {
      const accessToken = await getValidAccessToken(user.id, 'google');
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data } = await oauth2.userinfo.get();
      email = data.email || undefined;
    } catch (error) {
      console.error('Failed to fetch user email:', error);
      // Continue without email if this fails
    }

    return NextResponse.json({
      connected: true,
      provider: 'google',
      email,
      lastSync: token.updatedAt,
      scopes: token.scopes,
    });
  } catch (error) {
    console.error('Failed to check connection status:', error);
    return NextResponse.json(
      { error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}
