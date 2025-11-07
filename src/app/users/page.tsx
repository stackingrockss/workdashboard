// app/users/page.tsx
// User management page for ADMIN and MANAGER roles

import { requireAuth } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { UserManagementClient } from "@/components/features/users/user-management-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  // Require authentication
  const user = await requireAuth();

  // Check permission to manage users
  if (!canManageUsers(user)) {
    redirect("/opportunities");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team Members</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization's users, roles, and reporting structure
        </p>
      </div>

      <UserManagementClient />
    </div>
  );
}
