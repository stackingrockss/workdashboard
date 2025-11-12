"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Plug } from "lucide-react";
import { OrganizationSettingsClient } from "./organization-settings-client";
import { UserManagementClient } from "@/components/features/users/user-management-client";
import { IntegrationsSettingsContent } from "./integrations-settings-content";

export function OrganizationSettingsTabs() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("general");

  // Update active tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["general", "team", "integrations"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="general" className="gap-2">
          <Building2 className="h-4 w-4" />
          General
        </TabsTrigger>
        <TabsTrigger value="team" className="gap-2">
          <Users className="h-4 w-4" />
          Team
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-2">
          <Plug className="h-4 w-4" />
          Integrations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6">
        <OrganizationSettingsClient />
      </TabsContent>

      <TabsContent value="team" className="space-y-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Team Members</h2>
            <p className="text-muted-foreground mt-1">
              Manage your organization&apos;s users, roles, and reporting structure
            </p>
          </div>
          <UserManagementClient />
        </div>
      </TabsContent>

      <TabsContent value="integrations" className="space-y-6">
        <Suspense fallback={<div className="text-muted-foreground">Loading integrations...</div>}>
          <IntegrationsSettingsContent />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
