// API endpoint to retry parsing for a stuck GongCall
import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the call
    const call = await prisma.gongCall.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        parsingStatus: true,
        transcriptText: true,
        opportunityId: true,
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    if (!call.transcriptText) {
      return NextResponse.json(
        { error: 'No transcript text available to parse' },
        { status: 400 }
      );
    }

    // Reset the parsing status
    await prisma.gongCall.update({
      where: { id },
      data: {
        parsingStatus: 'pending',
        parsingError: null,
      },
    });

    // Trigger Inngest parsing job
    await inngest.send({
      name: 'gong/transcript.parse',
      data: {
        gongCallId: id,
        transcriptText: call.transcriptText,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Parsing restarted for call: ${call.title}`,
      callId: id,
      status: 'pending',
    });
  } catch (error) {
    console.error('Error restarting parsing:', error);
    return NextResponse.json(
      {
        error: 'Failed to restart parsing',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
