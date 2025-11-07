import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { canInviteUsers } from "@/lib/permissions";

/**
 * DELETE /api/v1/invitations/[id]
 * Cancel/delete a pending invitation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Check permission to manage invitations
    if (!canInviteUsers(user)) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to manage invitations" },
        { status: 403 }
      );
    }

    // Find the invitation
    const invitation = await prisma.invitation.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "Cannot delete an accepted invitation" },
        { status: 400 }
      );
    }

    // Delete the invitation
    await prisma.invitation.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Invitation deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting invitation:", error);
    return NextResponse.json(
      { error: "Failed to delete invitation" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/invitations/[id]/resend
 * Resend an invitation email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Check permission to manage invitations
    if (!canInviteUsers(user)) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to manage invitations" },
        { status: 403 }
      );
    }

    // Find the invitation
    const invitation = await prisma.invitation.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "Cannot resend an accepted invitation" },
        { status: 400 }
      );
    }

    // Check if expired - if so, extend expiration
    const now = new Date();
    if (now > invitation.expiresAt) {
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      await prisma.invitation.update({
        where: { id },
        data: { expiresAt: newExpiresAt },
      });
    }

    // TODO: Resend invitation email
    // This would involve sending the email again via your email service

    return NextResponse.json(
      { message: "Invitation resent successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error resending invitation:", error);
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}
