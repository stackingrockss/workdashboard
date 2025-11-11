import crypto from 'crypto';
import { prisma } from '@/lib/db';

const ALGORITHM = 'aes-256-gcm';

/**
 * Validates the encryption key is present and correct length
 * @throws Error if key is missing or invalid
 */
function validateEncryptionKey(): string {
  const key = process.env.OAUTH_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'OAUTH_ENCRYPTION_KEY environment variable is not set. Generate one with: openssl rand -hex 16'
    );
  }

  if (key.length !== 32) {
    throw new Error(
      `OAUTH_ENCRYPTION_KEY must be exactly 32 characters long (current: ${key.length}). Generate one with: openssl rand -hex 16`
    );
  }

  return key;
}

/**
 * Encrypts an OAuth token using AES-256-GCM
 * Returns format: iv:authTag:encrypted
 */
export function encryptToken(token: string): string {
  const encryptionKey = validateEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an OAuth token
 */
export function decryptToken(encryptedToken: string): string {
  const encryptionKey = validateEncryptionKey();

  try {
    const [ivHex, authTagHex, encryptedHex] = encryptedToken.split(':');

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    // Don't log error details to avoid potential token leakage
    console.error('Failed to decrypt token');
    throw new Error('Failed to decrypt OAuth token');
  }
}

/**
 * Checks if a token has expired (with 5-minute buffer for safety)
 */
export function isTokenExpired(expiresAt: Date): boolean {
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes in milliseconds
  return now.getTime() > expiresAt.getTime() - bufferMs;
}

/**
 * Refreshes a Google OAuth token using refresh token
 * Returns new access token and expiration time
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Token refresh failed:', error);
      throw new Error('Failed to refresh OAuth token');
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw new Error('Failed to refresh OAuth token');
  }
}

/**
 * Gets a valid access token for a user (auto-refreshes if needed)
 * Throws an error if calendar is not connected or token cannot be refreshed
 */
export async function getValidAccessToken(
  userId: string,
  provider: string = 'google'
): Promise<string> {
  // Find the OAuth token for this user and provider
  const token = await prisma.oAuthToken.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  if (!token) {
    throw new Error('Calendar not connected. Please connect your calendar in Settings.');
  }

  // Check if token is expired
  if (isTokenExpired(token.expiresAt)) {
    if (!token.refreshToken) {
      throw new Error('No refresh token available. Please reconnect your calendar.');
    }

    try {
      // Decrypt the refresh token
      const decryptedRefreshToken = decryptToken(token.refreshToken);

      // Refresh the access token
      const newToken = await refreshGoogleToken(decryptedRefreshToken);

      // Calculate new expiration date
      const expiresAt = new Date(Date.now() + newToken.expires_in * 1000);

      // Update the token in database with optimistic locking
      // Only update if the token hasn't been modified since we read it
      try {
        await prisma.oAuthToken.updateMany({
          where: {
            id: token.id,
            updatedAt: token.updatedAt, // Optimistic lock
          },
          data: {
            accessToken: encryptToken(newToken.access_token),
            expiresAt,
            updatedAt: new Date(),
          },
        });
      } catch {
        // Token was updated by another request, fetch the fresh token
        console.log('Token was updated concurrently, fetching fresh token');
        return await getValidAccessToken(userId, provider);
      }

      return newToken.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw new Error('Failed to refresh calendar access. Please reconnect your calendar.');
    }
  }

  // Token is still valid, decrypt and return
  return decryptToken(token.accessToken);
}

/**
 * Revokes a Google OAuth token
 */
export async function revokeGoogleToken(accessToken: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  } catch (error) {
    console.error('Failed to revoke token:', error);
    // Don't throw error - we'll delete the token from DB anyway
  }
}
