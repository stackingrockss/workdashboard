import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/integrations/google/authorize
 * Initiates Google OAuth flow for calendar access
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

    // Verify environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Google OAuth credentials not configured');
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Generate authorization URL with calendar.events scope (read + write)
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent screen to get refresh token
      scope: [
        'https://www.googleapis.com/auth/calendar.events', // Read + write calendar events
        'https://www.googleapis.com/auth/userinfo.email', // Get user email
      ],
      state: supabaseUser.id, // Pass user ID for verification in callback
    });

    // Redirect to Google OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
