"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mic,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Unplug,
  Eye,
  EyeOff,
  TestTube,
} from "lucide-react";
import { toast } from "sonner";
import {
  gongIntegrationCreateSchema,
  type GongIntegrationCreateInput,
} from "@/lib/validations/gong-integration";
import { formatDateShort } from "@/lib/format";

interface GongIntegrationStatus {
  connected: boolean;
  isEnabled: boolean;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  syncIntervalMinutes?: number;
  syncedCallCount?: number;
}

export function GongIntegrationCard() {
  const [status, setStatus] = useState<GongIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showAccessKeySecret, setShowAccessKeySecret] = useState(false);

  const form = useForm<GongIntegrationCreateInput>({
    resolver: zodResolver(gongIntegrationCreateSchema),
    defaultValues: {
      accessKey: "",
      accessKeySecret: "",
    },
  });

  // Load integration status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, syncRes] = await Promise.all([
        fetch("/api/v1/integrations/gong"),
        fetch("/api/v1/integrations/gong/sync").catch(() => null),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        const syncData = syncRes?.ok ? await syncRes.json() : {};
        setStatus({
          ...data,
          syncedCallCount: syncData.syncedCallCount,
        });
      } else {
        setStatus({ connected: false, isEnabled: false });
      }
    } catch (error) {
      console.error("Failed to check Gong status:", error);
      setStatus({ connected: false, isEnabled: false });
    } finally {
      setLoading(false);
    }
  };

  const handleTestCredentials = async () => {
    const values = form.getValues();

    if (!values.accessKey || !values.accessKeySecret) {
      toast.error("Please enter both Access Key and Access Key Secret");
      return;
    }

    setTesting(true);
    try {
      const response = await fetch("/api/v1/integrations/gong/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Connection successful!", {
          description: `Found ${data.userCount} users in your Gong workspace`,
        });
      } else {
        toast.error("Connection failed", {
          description: data.message || "Invalid credentials",
        });
      }
    } catch (error) {
      console.error("Test failed:", error);
      toast.error("Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveCredentials = async (data: GongIntegrationCreateInput) => {
    setSaving(true);
    try {
      const response = await fetch("/api/v1/integrations/gong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success("Gong integration connected successfully!");
        form.reset();
        setShowCredentialForm(false);
        await checkStatus();
      } else {
        toast.error(result.error || "Failed to save credentials");
      }
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save Gong integration");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/v1/integrations/gong", {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Gong integration disconnected");
        setShowDisconnectDialog(false);
        await checkStatus();
      } else {
        toast.error(data.error || "Failed to disconnect");
      }
    } catch (error) {
      console.error("Disconnect failed:", error);
      toast.error("Failed to disconnect Gong integration");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/v1/integrations/gong/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullSync: false }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Sync started", {
          description: data.message,
        });
        // Refresh status after a short delay
        setTimeout(checkStatus, 2000);
      } else {
        toast.error(data.error || "Failed to start sync");
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Failed to start sync");
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      const response = await fetch("/api/v1/integrations/gong", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: enabled }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(enabled ? "Gong sync enabled" : "Gong sync disabled");
        await checkStatus();
      } else {
        toast.error(data.error || "Failed to update setting");
      }
    } catch (error) {
      console.error("Toggle failed:", error);
      toast.error("Failed to update setting");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            <CardTitle>Gong Integration</CardTitle>
          </div>
          <CardDescription>
            Sync call recordings and transcripts from Gong
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              <CardTitle>Gong Integration</CardTitle>
            </div>
            {status?.connected ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="mr-1 h-3 w-3" />
                Not Connected
              </Badge>
            )}
          </div>
          <CardDescription>
            Automatically sync call recordings and transcripts from Gong for AI
            parsing and insights extraction.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Connected State */}
          {status?.connected && (
            <>
              {/* Sync Status */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Auto-Sync</span>
                  <Switch
                    checked={status.isEnabled}
                    onCheckedChange={handleToggleEnabled}
                  />
                </div>

                {status.lastSyncAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last synced</span>
                    <span>{formatDateShort(new Date(status.lastSyncAt))}</span>
                  </div>
                )}

                {status.lastSyncStatus && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={
                        status.lastSyncStatus === "success"
                          ? "default"
                          : status.lastSyncStatus === "in_progress"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {status.lastSyncStatus}
                    </Badge>
                  </div>
                )}

                {status.syncedCallCount !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Calls synced</span>
                    <span>{status.syncedCallCount}</span>
                  </div>
                )}

                {status.lastSyncError && (
                  <div className="text-sm text-destructive">
                    Error: {status.lastSyncError}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSyncNow}
                  disabled={syncing || status.lastSyncStatus === "in_progress"}
                >
                  {syncing || status.lastSyncStatus === "in_progress" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDisconnectDialog(true)}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            </>
          )}

          {/* Not Connected State */}
          {!status?.connected && !showCredentialForm && (
            <>
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Connect your Gong account to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Automatically sync call recordings</li>
                  <li>Extract transcripts for AI analysis</li>
                  <li>Link calls to opportunities and accounts</li>
                  <li>Generate insights from customer conversations</li>
                </ul>
              </div>

              <Button onClick={() => setShowCredentialForm(true)}>
                Connect Gong
              </Button>
            </>
          )}

          {/* Credential Form */}
          {!status?.connected && showCredentialForm && (
            <form
              onSubmit={form.handleSubmit(handleSaveCredentials)}
              className="space-y-4"
            >
              <div className="text-sm text-muted-foreground mb-4">
                <p>
                  Get your API credentials from{" "}
                  <a
                    href="https://app.gong.io/company/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Gong API Settings
                  </a>{" "}
                  (requires Technical Administrator access).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessKey">Access Key</Label>
                <div className="relative">
                  <Input
                    id="accessKey"
                    type={showAccessKey ? "text" : "password"}
                    placeholder="Enter your Gong Access Key"
                    {...form.register("accessKey")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowAccessKey(!showAccessKey)}
                  >
                    {showAccessKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {form.formState.errors.accessKey && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.accessKey.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessKeySecret">Access Key Secret</Label>
                <div className="relative">
                  <Input
                    id="accessKeySecret"
                    type={showAccessKeySecret ? "text" : "password"}
                    placeholder="Enter your Gong Access Key Secret"
                    {...form.register("accessKeySecret")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowAccessKeySecret(!showAccessKeySecret)}
                  >
                    {showAccessKeySecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {form.formState.errors.accessKeySecret && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.accessKeySecret.message}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestCredentials}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCredentialForm(false);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Gong Integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop syncing calls from Gong. Your existing synced calls
              and their parsed insights will be preserved. You can reconnect at
              any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
