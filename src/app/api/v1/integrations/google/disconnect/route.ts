import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { decryptToken, revokeGoogleToken } from '@/lib/integrations/oauth-helpers';

/**
 * POST /api/v1/integrations/google/disconnect
 * Revokes Google Calendar access and deletes stored tokens
 */
export async function POST() {
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
      return NextResponse.json(
        { error: 'No connected calendar found' },
        { status: 404 }
      );
    }

    // Revoke the token with Google (best effort - don't fail if this errors)
    try {
      const accessToken = decryptToken(token.accessToken);
      await revokeGoogleToken(accessToken);
    } catch (error) {
      console.error('Failed to revoke token with Google:', error);
      // Continue with deletion anyway
    }

    // Delete the OAuth token from database
    await prisma.oAuthToken.delete({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google',
        },
      },
    });

    // Optionally: Delete all calendar events for this user
    // (Uncomment if you want to clean up synced events)
    // await prisma.calendarEvent.deleteMany({
    //   where: { userId: user.id },
    // });

    return NextResponse.json({
      success: true,
      message: 'Google Calendar disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect calendar' },
      { status: 500 }
    );
  }
}
