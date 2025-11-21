"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User as UserIcon, Plug, Bell, Shield } from "lucide-react";
import { IntegrationsSettingsContent } from "./integrations-settings-content";
import { UserProfileSettings } from "./user-profile-settings";

interface UserSettingsTabsProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    avatarUrl: string | null;
    annualQuota: number | null;
  };
}

export function UserSettingsTabs({ user }: UserSettingsTabsProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("profile");

  // Update active tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["profile", "integrations", "notifications", "security"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
        <TabsTrigger value="profile" className="gap-2">
          <UserIcon className="h-4 w-4" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-2">
          <Plug className="h-4 w-4" />
          Integrations
        </TabsTrigger>
        <TabsTrigger value="notifications" className="gap-2" disabled>
          <Bell className="h-4 w-4" />
          Notifications
        </TabsTrigger>
        <TabsTrigger value="security" className="gap-2" disabled>
          <Shield className="h-4 w-4" />
          Security
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-6">
        <UserProfileSettings user={user} />
      </TabsContent>

      <TabsContent value="integrations" className="space-y-6">
        <Suspense fallback={<div className="text-muted-foreground">Loading integrations...</div>}>
          <IntegrationsSettingsContent />
        </Suspense>
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6">
        <div className="text-muted-foreground">
          Notification preferences coming soon...
        </div>
      </TabsContent>

      <TabsContent value="security" className="space-y-6">
        <div className="text-muted-foreground">
          Security settings coming soon...
        </div>
      </TabsContent>
    </Tabs>
  );
}
