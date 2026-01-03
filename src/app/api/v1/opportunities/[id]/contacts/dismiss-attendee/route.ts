import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  dismissAttendee,
  undismissAttendee,
} from "@/lib/integrations/enrichment/service";

/**
 * POST /api/v1/opportunities/[id]/contacts/dismiss-attendee
 * Dismiss an attendee from import suggestions
 * Body: { email: string, sourceCalendarEventId?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

    // Parse request body
    let email: string;
    let sourceCalendarEventId: string | undefined;
    try {
      const body = await request.json();
      if (!body.email || typeof body.email !== "string") {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 }
        );
      }
      email = body.email;
      sourceCalendarEventId = body.sourceCalendarEventId;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const result = await dismissAttendee(
      opportunityId,
      user.organization.id,
      user.id,
      email,
      sourceCalendarEventId
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to dismiss attendee:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to dismiss attendee" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/opportunities/[id]/contacts/dismiss-attendee
 * Undismiss an attendee so they show up in import suggestions again
 * Body: { email: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

    // Parse request body
    let email: string;
    try {
      const body = await request.json();
      if (!body.email || typeof body.email !== "string") {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 }
        );
      }
      email = body.email;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const result = await undismissAttendee(
      opportunityId,
      user.organization.id,
      email
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to undismiss attendee:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to undismiss attendee" },
      { status: 500 }
    );
  }
}
