import { prisma } from '../src/lib/db';
import { decryptToken, isTokenExpired, refreshGoogleToken, encryptToken } from '../src/lib/integrations/oauth-helpers';

/**
 * Diagnostic script to check OAuth token status
 * Usage: npx tsx scripts/diagnose-oauth.ts
 */
async function diagnoseOAuthTokens() {
  try {
    console.log('🔍 Checking OAuth tokens...\n');

    // Find all OAuth tokens
    const tokens = await prisma.oAuthToken.findMany({
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
      console.log('   → User needs to connect their Google Calendar in Settings');
      return;
    }

    console.log(`✅ Found ${tokens.length} OAuth token(s)\n`);

    for (const token of tokens) {
      console.log(`\n📧 User: ${token.user.email} (${token.user.name})`);
      console.log(`   Provider: ${token.provider}`);
      console.log(`   Scopes: ${token.scopes.join(', ')}`);
      console.log(`   Expires at: ${token.expiresAt.toISOString()}`);
      console.log(`   Is expired: ${isTokenExpired(token.expiresAt)}`);
      console.log(`   Has refresh token: ${!!token.refreshToken}`);
      console.log(`   Created: ${token.createdAt.toISOString()}`);
      console.log(`   Updated: ${token.updatedAt.toISOString()}`);

      // Check if encryption key is configured
      const encryptionKey = process.env.OAUTH_ENCRYPTION_KEY;
      if (!encryptionKey) {
        console.log('   ❌ OAUTH_ENCRYPTION_KEY not configured');
        continue;
      }

      if (encryptionKey.length !== 32) {
        console.log(`   ❌ OAUTH_ENCRYPTION_KEY has wrong length: ${encryptionKey.length} (should be 32)`);
        continue;
      }

      // Try to decrypt the access token
      try {
        decryptToken(token.accessToken);
        console.log('   ✅ Access token can be decrypted');
      } catch (error) {
        console.log('   ❌ Failed to decrypt access token');
        console.log(`      Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      // If token is expired, try to refresh
      if (isTokenExpired(token.expiresAt)) {
        console.log('   ⚠️  Token is expired');

        if (token.refreshToken) {
          console.log('   🔄 Attempting to refresh token...');

          try {
            const decryptedRefreshToken = decryptToken(token.refreshToken);
            const newToken = await refreshGoogleToken(decryptedRefreshToken);

            console.log('   ✅ Token refresh successful!');
            console.log(`      New token expires in: ${newToken.expires_in} seconds`);

            // Update the token in database
            const expiresAt = new Date(Date.now() + newToken.expires_in * 1000);
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
            console.log('   ❌ Token refresh failed');
            console.log(`      Error: ${error instanceof Error ? error.message : String(error)}`);
            console.log('      → User needs to reconnect their Google Calendar in Settings');
          }
        } else {
          console.log('   ❌ No refresh token available');
          console.log('      → User needs to reconnect their Google Calendar in Settings');
        }
      } else {
        console.log('   ✅ Token is still valid');
      }
    }

    console.log('\n✅ Diagnostic complete\n');
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseOAuthTokens();