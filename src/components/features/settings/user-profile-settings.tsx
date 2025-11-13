"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface UserProfileSettingsProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    avatarUrl: string | null;
  };
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  REP: "Sales Rep",
  VIEWER: "Viewer",
};

const roleColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ADMIN: "destructive",
  MANAGER: "default",
  REP: "secondary",
  VIEWER: "outline",
};

export function UserProfileSettings({ user }: UserProfileSettingsProps) {
  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Profile Information</h2>
        <p className="text-muted-foreground mt-1">
          Your personal account information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            View your account information. Contact your administrator to make changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.avatarUrl || undefined} alt={user.name || "User"} />
              <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">{user.name || "Unnamed User"}</h3>
                <Badge variant={roleColors[user.role] || "outline"}>
                  {roleLabels[user.role] || user.role}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">User ID</label>
              <p className="text-sm text-muted-foreground font-mono">{user.id}</p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Role</label>
              <p className="text-sm text-muted-foreground">
                {roleLabels[user.role] || user.role}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Need to Update Your Information?</CardTitle>
          <CardDescription>
            Contact your organization administrator to update your profile information, role, or permissions.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
