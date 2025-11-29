"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface UserPreferencesSettingsProps {
  user: {
    id: string;
    autoCreateMeetingTasks?: boolean;
  };
}

export function UserPreferencesSettings({ user }: UserPreferencesSettingsProps) {
  const [autoCreateMeetingTasks, setAutoCreateMeetingTasks] = useState(
    user.autoCreateMeetingTasks ?? true
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleMeetingTasks = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/v1/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          autoCreateMeetingTasks: enabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preference');
      }

      setAutoCreateMeetingTasks(enabled);
      toast.success(enabled ? 'Meeting tasks enabled' : 'Meeting tasks disabled');
    } catch (error) {
      console.error('Failed to update meeting task preference:', error);
      toast.error('Failed to update preference');
      // Revert the switch
      setAutoCreateMeetingTasks(!enabled);
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
              <label className="text-sm font-medium">Automatic Meeting Tasks</label>
              <p className="text-sm text-muted-foreground">
                Automatically create Google Tasks for external meetings linked to opportunities.
                Creates a prep task (due day before) and follow-up task (due meeting day).
              </p>
            </div>
            <Switch
              checked={autoCreateMeetingTasks}
              onCheckedChange={handleToggleMeetingTasks}
              disabled={isUpdating}
              className="ml-4"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
