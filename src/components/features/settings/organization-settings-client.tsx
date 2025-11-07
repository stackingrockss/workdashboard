"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  domain: z.string().optional().nullable(),
  fiscalYearStartMonth: z.number().min(1).max(12),
});

const settingsSchema = z.object({
  allowSelfSignup: z.boolean(),
  allowDomainAutoJoin: z.boolean(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;
type SettingsFormData = z.infer<typeof settingsSchema>;

interface Organization {
  id: string;
  name: string;
  domain: string | null;
  fiscalYearStartMonth: number;
  userCount: number;
  opportunityCount: number;
  accountCount: number;
}

interface Settings {
  allowSelfSignup: boolean;
  allowDomainAutoJoin: boolean;
}

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function OrganizationSettingsClient() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const orgForm = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
  });

  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (organization) {
      orgForm.reset({
        name: organization.name,
        domain: organization.domain,
        fiscalYearStartMonth: organization.fiscalYearStartMonth,
      });
    }
  }, [organization, orgForm]);

  useEffect(() => {
    if (settings) {
      settingsForm.reset({
        allowSelfSignup: settings.allowSelfSignup,
        allowDomainAutoJoin: settings.allowDomainAutoJoin,
      });
    }
  }, [settings, settingsForm]);

  async function fetchData() {
    try {
      setLoading(true);

      const [orgRes, settingsRes] = await Promise.all([
        fetch("/api/v1/organization"),
        fetch("/api/v1/organization/settings"),
      ]);

      if (!orgRes.ok || !settingsRes.ok) {
        throw new Error("Failed to fetch organization data");
      }

      const orgData = await orgRes.json();
      const settingsData = await settingsRes.json();

      setOrganization(orgData.organization);
      setSettings(settingsData.settings);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load organization settings");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitOrganization(data: OrganizationFormData) {
    try {
      setSaving(true);

      const res = await fetch("/api/v1/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update organization");
      }

      toast.success("Organization updated successfully!");
      fetchData();
    } catch (error) {
      console.error("Error updating organization:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update organization"
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitSettings(data: SettingsFormData) {
    try {
      setSaving(true);

      const res = await fetch("/api/v1/organization/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update settings");
      }

      toast.success("Settings updated successfully!");
      fetchData();
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update settings"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization Stats */}
      {organization && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organization.userCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {organization.opportunityCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organization.accountCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Update your organization&apos;s name, domain, and fiscal year settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={orgForm.handleSubmit(onSubmitOrganization)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                {...orgForm.register("name")}
                disabled={saving}
              />
              {orgForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {orgForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain (optional)</Label>
              <Input
                id="domain"
                placeholder="company.com"
                {...orgForm.register("domain")}
                disabled={saving}
              />
              <p className="text-sm text-muted-foreground">
                Used for domain-based auto-join when enabled
              </p>
              {orgForm.formState.errors.domain && (
                <p className="text-sm text-destructive">
                  {orgForm.formState.errors.domain.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fiscalYearStartMonth">Fiscal Year Start Month</Label>
              <Select
                value={orgForm.watch("fiscalYearStartMonth")?.toString()}
                onValueChange={(value) =>
                  orgForm.setValue("fiscalYearStartMonth", parseInt(value))
                }
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Used for quarterly reporting and planning
              </p>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Access Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Access Settings</CardTitle>
          <CardDescription>
            Control how users can join your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={settingsForm.handleSubmit(onSubmitSettings)}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="allowSelfSignup">Allow Self Signup</Label>
                <p className="text-sm text-muted-foreground">
                  Anyone can create an account and join your organization
                </p>
              </div>
              <Switch
                id="allowSelfSignup"
                checked={settingsForm.watch("allowSelfSignup")}
                onCheckedChange={(checked: boolean) =>
                  settingsForm.setValue("allowSelfSignup", checked)
                }
                disabled={saving}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="allowDomainAutoJoin">Domain-Based Auto-Join</Label>
                <p className="text-sm text-muted-foreground">
                  Users with matching email domain automatically join (requires domain
                  to be set)
                </p>
              </div>
              <Switch
                id="allowDomainAutoJoin"
                checked={settingsForm.watch("allowDomainAutoJoin")}
                onCheckedChange={(checked: boolean) =>
                  settingsForm.setValue("allowDomainAutoJoin", checked)
                }
                disabled={saving || !organization?.domain}
              />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
