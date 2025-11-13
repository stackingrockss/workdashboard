import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { UserSettingsTabs } from "@/components/features/settings/user-settings-tabs";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * User Settings Page
 *
 * Personal settings for the authenticated user including:
 * - Profile information
 * - Integration connections (Google Calendar, etc.)
 * - Notification preferences
 * - Security settings
 */
export default async function UserSettingsPage() {
  // Require authentication
  const user = await requireAuth();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your personal profile and integrations
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <UserSettingsTabs user={user} />
      </Suspense>
    </div>
  );
}