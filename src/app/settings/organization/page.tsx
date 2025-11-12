// app/settings/organization/page.tsx
// Organization settings page for ADMIN only with tabs

import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { OrganizationSettingsTabs } from "@/components/features/settings/organization-settings-tabs";
import { Loader2 } from "lucide-react";

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
          Manage your organization&apos;s configuration, team members, and integrations
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <OrganizationSettingsTabs />
      </Suspense>
    </div>
  );
}
