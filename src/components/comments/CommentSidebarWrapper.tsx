// src/components/comments/CommentSidebarWrapper.tsx
// Server component wrapper that fetches user data and renders client CommentSidebar

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CommentSidebar } from "./CommentSidebar";

export async function CommentSidebarWrapper() {
  try {
    const user = await requireAuth();

    // Fetch all users in the organization for @mentions
    const organizationUsers = await prisma.user.findMany({
      where: {
        organizationId: user.organization.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return (
      <CommentSidebar
        currentUser={{
          id: user.id,
          role: user.role,
          organizationId: user.organization.id,
        }}
        organizationUsers={organizationUsers}
      />
    );
  } catch (error) {
    // If not authenticated, don't render sidebar
    return null;
  }
}
