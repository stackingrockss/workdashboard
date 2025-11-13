"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users } from "lucide-react";
import { OrganizationSettingsClient } from "./organization-settings-client";
import { UserManagementClient } from "@/components/features/users/user-management-client";

export function OrganizationSettingsTabs() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("general");

  // Update active tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["general", "team"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 lg:w-[300px]">
        <TabsTrigger value="general" className="gap-2">
          <Building2 className="h-4 w-4" />
          General
        </TabsTrigger>
        <TabsTrigger value="team" className="gap-2">
          <Users className="h-4 w-4" />
          Team
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
    </Tabs>
  );
}
