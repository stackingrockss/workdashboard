// Admin endpoint to retry ALL stuck parsing jobs
import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    // Find all calls stuck in parsing status
    const stuckCalls = await prisma.gongCall.findMany({
      where: {
        parsingStatus: 'parsing',
      },
      select: {
        id: true,
        title: true,
        transcriptText: true,
        opportunityId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (stuckCalls.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stuck parsing jobs found',
        count: 0,
      });
    }

    const results = [];

    for (const call of stuckCalls) {
      if (!call.transcriptText) {
        results.push({
          id: call.id,
          title: call.title,
          status: 'skipped',
          reason: 'No transcript text',
        });
        continue;
      }

      try {
        // Reset status to pending
        await prisma.gongCall.update({
          where: { id: call.id },
          data: {
            parsingStatus: 'pending',
            parsingError: null,
          },
        });

        // Trigger Inngest job
        await inngest.send({
          name: 'gong/transcript.parse',
          data: {
            gongCallId: call.id,
            transcriptText: call.transcriptText,
          },
        });

        results.push({
          id: call.id,
          title: call.title,
          status: 'restarted',
        });
      } catch (error) {
        results.push({
          id: call.id,
          title: call.title,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Restarted ${results.filter((r) => r.status === 'restarted').length} parsing jobs`,
      totalFound: stuckCalls.length,
      results,
    });
  } catch (error) {
    console.error('Error restarting stuck parsing jobs:', error);
    return NextResponse.json(
      {
        error: 'Failed to restart parsing jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
