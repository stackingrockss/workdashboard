"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from "@/lib/format";
import { Loader2 } from "lucide-react";

const quotaFormSchema = z.object({
  annualQuota: z.number().int().positive("Quota must be a positive number").nullable(),
});

interface UserProfileSettingsProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    avatarUrl: string | null;
    annualQuota: number | null;
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

type QuotaFormData = z.infer<typeof quotaFormSchema>;

export function UserProfileSettings({ user }: UserProfileSettingsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quotaInputValue, setQuotaInputValue] = useState(
    user.annualQuota ? formatCurrencyInput(user.annualQuota) : ""
  );

  const { handleSubmit, setValue, formState: { isDirty } } = useForm<QuotaFormData>({
    resolver: zodResolver(quotaFormSchema),
    defaultValues: {
      annualQuota: user.annualQuota,
    },
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const onSubmit = async (data: QuotaFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annualQuota: data.annualQuota }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update quota");
      }

      toast.success("Annual quota updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update quota");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuotaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuotaInputValue(value);
    const parsed = parseCurrencyInput(value);
    setValue("annualQuota", parsed > 0 ? parsed : null, { shouldDirty: true });
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
            View your account information. Contact your administrator to change your name, email, or role.
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
          <CardTitle>Sales Quota</CardTitle>
          <CardDescription>
            Set your annual sales quota for tracking performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="annualQuota">Annual Quota</Label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="annualQuota"
                  type="text"
                  placeholder="0"
                  value={quotaInputValue}
                  onChange={handleQuotaChange}
                  className="pl-7"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Enter your annual sales target. This is used to track quota attainment.
              </p>
            </div>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Quota
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Need to Update Your Information?</CardTitle>
          <CardDescription>
            Contact your organization administrator to update your name, email, role, or permissions.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
