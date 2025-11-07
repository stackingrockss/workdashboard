import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { invitationCreateSchema } from "@/lib/validations/invitation";
import { canInviteUsers } from "@/lib/permissions";
import { generateInvitationToken } from "@/lib/organization";

/**
 * GET /api/v1/invitations
 * List all pending invitations for the organization
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Check permission to view invitations
    if (!canInviteUsers(user)) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to view invitations" },
        { status: 403 }
      );
    }

    // Get all pending invitations for the organization
    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: user.organization.id,
        acceptedAt: null, // Only pending invitations
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to include status
    const sanitizedInvitations = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      token: inv.token,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      invitedBy: inv.invitedBy,
      status: new Date() > inv.expiresAt ? "expired" : "pending",
    }));

    return NextResponse.json(
      { invitations: sanitizedInvitations },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/invitations
 * Send an invitation to join the organization
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check permission to invite users
    if (!canInviteUsers(user)) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to invite users" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = invitationCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if user already exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      if (existingUser.organizationId === user.organization.id) {
        return NextResponse.json(
          { error: "User with this email is already in your organization" },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: "User with this email already exists in another organization" },
          { status: 400 }
        );
      }
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: data.email,
        organizationId: user.organization.id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation for this email is already pending" },
        { status: 400 }
      );
    }

    // Generate token and expiration (7 days from now)
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create the invitation
    const invitation = await prisma.invitation.create({
      data: {
        email: data.email,
        role: data.role,
        organizationId: user.organization.id,
        invitedById: user.id,
        token,
        expiresAt,
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // TODO: Send invitation email
    // This would typically involve:
    // 1. Generate invitation link: `${baseUrl}/invite/accept?token=${token}`
    // 2. Send email via your email service (SendGrid, Resend, etc.)
    // For now, we'll just return the token so it can be shared manually

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
          invitedBy: invitation.invitedBy,
        },
        message: "Invitation created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
