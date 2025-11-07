// app/settings/organization/page.tsx
// Organization settings page for ADMIN only

import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { OrganizationSettingsClient } from "@/components/features/settings/organization-settings-client";

export const dynamic = "force-dynamic";

export default async function OrganizationSettingsPage() {
  // Require authentication
  const user = await requireAuth();

  // Only ADMIN can access organization settings
  if (!isAdmin(user)) {
    redirect("/opportunities");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization's configuration and preferences
        </p>
      </div>

      <OrganizationSettingsClient />
    </div>
  );
}
