import { NextRequest, NextResponse } from "next/server";
import { generatePreMeetingNotes } from "@/lib/ai/meeting-notes";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Request schema for meeting notes generation
 */
const meetingNotesRequestSchema = z.object({
  accountName: z.string().min(1, "Account name is required"),
  stage: z.string().optional(),
  industry: z.string().optional(),
  opportunityValue: z.number().optional(),
  opportunityId: z.string().optional(), // If provided, save to database
});

/**
 * Generate pre-meeting notes for an account
 * POST /api/v1/ai/meeting-notes
 * Body: { accountName: string, stage?: string, industry?: string, opportunityValue?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const validation = meetingNotesRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { accountName, stage, industry, opportunityValue, opportunityId } = validation.data;

    // Generate meeting notes
    const result = await generatePreMeetingNotes({
      accountName,
      stage,
      industry,
      opportunityValue,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to generate meeting notes",
        },
        { status: 500 }
      );
    }

    // If opportunityId provided, save to database
    if (opportunityId) {
      try {
        await prisma.opportunity.update({
          where: { id: opportunityId },
          data: {
            accountResearch: result.fullBrief,
            accountResearchMobile: result.mobileCheatSheet,
            accountResearchMeta: JSON.parse(JSON.stringify(result.metadata)), // Convert to Prisma Json type
            accountResearchGeneratedAt: new Date(),
            accountResearchStatus: "completed",
          },
        });
      } catch (dbError) {
        console.error("Failed to save meeting notes to database:", dbError);
        // Don't fail the request if DB save fails - return the generated content anyway
      }
    }

    return NextResponse.json({
      success: true,
      notes: result.fullBrief, // Legacy field
      fullBrief: result.fullBrief,
      mobileCheatSheet: result.mobileCheatSheet,
      metadata: result.metadata,
      accountName,
    });
  } catch (error) {
    console.error("Meeting notes API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/ai/meeting-notes",
    method: "POST",
    description: "Generate comprehensive pre-meeting notes for enterprise sales calls",
    body: {
      accountName: "string (required) - Name of the account/company",
      stage: "string (optional) - Opportunity stage",
      industry: "string (optional) - Account industry",
      opportunityValue: "number (optional) - Expected deal value",
      opportunityId: "string (optional) - If provided, saves result to database",
    },
    example: {
      accountName: "Kaiser Permanente",
      stage: "qualification",
      industry: "Healthcare",
      opportunityValue: 500000,
    },
  });
}
