import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserSettingsTabs } from "@/components/features/settings/user-settings-tabs";
import { Loader2, Settings } from "lucide-react";

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

  // Fetch full user data including preferences
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      annualQuota: true,
      autoCreateMeetingTasks: true,
    },
  });

  if (!fullUser) {
    throw new Error("User not found");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and integrations
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <UserSettingsTabs user={fullUser} />
      </Suspense>
    </div>
  );
}