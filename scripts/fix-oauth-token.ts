import { prisma } from '../src/lib/db';
import { decryptToken, refreshGoogleToken, encryptToken } from '../src/lib/integrations/oauth-helpers';

/**
 * Script to fix OAuth tokens with incorrect expiration dates
 * Refreshes all Google OAuth tokens
 * Usage: npx tsx scripts/fix-oauth-token.ts
 */
async function fixOAuthTokens() {
  try {
    console.log('🔧 Fixing OAuth tokens...\n');

    // Find all Google OAuth tokens
    const tokens = await prisma.oAuthToken.findMany({
      where: {
        provider: 'google',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (tokens.length === 0) {
      console.log('❌ No OAuth tokens found in database');
      return;
    }

    console.log(`✅ Found ${tokens.length} OAuth token(s)\n`);

    for (const token of tokens) {
      console.log(`\n📧 Processing user: ${token.user.email} (${token.user.name})`);
      console.log(`   Current expiration: ${token.expiresAt.toISOString()}`);

      if (!token.refreshToken) {
        console.log('   ❌ No refresh token available');
        console.log('      → User needs to reconnect their Google Calendar in Settings');
        continue;
      }

      try {
        // Decrypt refresh token
        console.log('   🔓 Decrypting refresh token...');
        const decryptedRefreshToken = decryptToken(token.refreshToken);

        // Refresh the access token
        console.log('   🔄 Refreshing access token...');
        const newToken = await refreshGoogleToken(decryptedRefreshToken);

        // Calculate new expiration (use expires_in from response)
        const expiresAt = new Date(Date.now() + newToken.expires_in * 1000);

        console.log(`   ✅ Token refreshed successfully!`);
        console.log(`      Expires in: ${newToken.expires_in} seconds (${Math.round(newToken.expires_in / 60)} minutes)`);
        console.log(`      New expiration: ${expiresAt.toISOString()}`);

        // Update the token in database
        await prisma.oAuthToken.update({
          where: { id: token.id },
          data: {
            accessToken: encryptToken(newToken.access_token),
            expiresAt,
            updatedAt: new Date(),
          },
        });

        console.log('   ✅ Token updated in database');
      } catch (error) {
        console.log('   ❌ Failed to refresh token');
        console.log(`      Error: ${error instanceof Error ? error.message : String(error)}`);
        console.log('      → User needs to reconnect their Google Calendar in Settings');

        // Delete the invalid token
        console.log('   🗑️  Deleting invalid token...');
        await prisma.oAuthToken.delete({
          where: { id: token.id },
        });
        console.log('   ✅ Invalid token deleted');
      }
    }

    console.log('\n✅ Token fix complete!\n');
  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixOAuthTokens();