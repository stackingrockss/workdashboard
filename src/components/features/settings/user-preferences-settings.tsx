"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface UserPreferencesSettingsProps {
  user: {
    id: string;
    autoCreateFollowupTasks?: boolean;
  };
}

export function UserPreferencesSettings({ user }: UserPreferencesSettingsProps) {
  const [autoCreateFollowupTasks, setAutoCreateFollowupTasks] = useState(
    user.autoCreateFollowupTasks ?? true
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleFollowupTasks = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/v1/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          autoCreateFollowupTasks: enabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preference');
      }

      setAutoCreateFollowupTasks(enabled);
      toast.success(enabled ? 'Follow-up tasks enabled' : 'Follow-up tasks disabled');
    } catch (error) {
      console.error('Failed to update follow-up task preference:', error);
      toast.error('Failed to update preference');
      // Revert the switch
      setAutoCreateFollowupTasks(!enabled);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Preferences</h2>
        <p className="text-muted-foreground mt-1">
          Customize your automated workflows and notifications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>
            Control automatic actions triggered by calendar events and opportunity updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">Automatic Follow-up Tasks</label>
              <p className="text-sm text-muted-foreground">
                Automatically create Google Tasks when external meetings linked to opportunities end.
                Tasks are created with the title &ldquo;[Company Name] follow up email&rdquo; and due tomorrow.
              </p>
            </div>
            <Switch
              checked={autoCreateFollowupTasks}
              onCheckedChange={handleToggleFollowupTasks}
              disabled={isUpdating}
              className="ml-4"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
