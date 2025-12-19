import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { gongIntegrationTestSchema } from '@/lib/validations/gong-integration';
import { createGongClient } from '@/lib/integrations/gong';

/**
 * POST /api/v1/integrations/gong/test
 * Test Gong API credentials without saving them
 * Requires: ADMIN role
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins can test integration credentials
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Only administrators can test Gong credentials' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = gongIntegrationTestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { accessKey, accessKeySecret } = parsed.data;

    // Test the credentials by making a simple API call
    const client = createGongClient(accessKey, accessKeySecret);

    try {
      const isValid = await client.testConnection();

      if (isValid) {
        // Get additional info for confirmation
        const users = await client.listUsers();
        const userCount = users.records.totalRecords;

        return NextResponse.json({
          success: true,
          message: 'Connection successful',
          userCount,
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Connection failed - invalid credentials',
        });
      }
    } catch (gongError) {
      console.error('Gong API test failed:', gongError);

      return NextResponse.json({
        success: false,
        message:
          gongError instanceof Error
            ? gongError.message
            : 'Connection failed - unable to reach Gong API',
      });
    }
  } catch (error) {
    console.error('Failed to test Gong credentials:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to test credentials' },
      { status: 500 }
    );
  }
}
