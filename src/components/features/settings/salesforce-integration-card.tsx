"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Cloud,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Unplug,
  AlertCircle,
  Settings2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface SalesforceStatus {
  connected: boolean;
  isEnabled: boolean;
  connectionValid?: boolean;
  instanceUrl: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  syncDirection: string | null;
  syncIntervalMinutes: number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface SalesforceIntegrationCardProps {
  userRole: string;
}

export function SalesforceIntegrationCard({ userRole }: SalesforceIntegrationCardProps) {
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [status, setStatus] = useState<SalesforceStatus>({
    connected: false,
    isEnabled: false,
    instanceUrl: null,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    syncDirection: null,
    syncIntervalMinutes: null,
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    isEnabled: true,
    syncDirection: "bidirectional",
    syncIntervalMinutes: 60,
  });

  const isAdmin = userRole === "ADMIN";

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/integrations/salesforce/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        // Initialize settings form with current values
        if (data.connected) {
          setSettingsForm({
            isEnabled: data.isEnabled ?? true,
            syncDirection: data.syncDirection ?? "bidirectional",
            syncIntervalMinutes: data.syncIntervalMinutes ?? 60,
          });
        }
      }
    } catch (error) {
      console.error("Failed to check Salesforce status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleConnect = () => {
    // Redirect to Salesforce OAuth
    window.location.href = "/api/v1/integrations/salesforce/auth";
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/v1/integrations/salesforce/disconnect", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect");
      }

      toast.success("Salesforce disconnected successfully");
      setStatus({
        connected: false,
        isEnabled: false,
        instanceUrl: null,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        syncDirection: null,
        syncIntervalMinutes: null,
      });
      setShowDisconnectDialog(false);
    } catch (error) {
      console.error("Failed to disconnect Salesforce:", error);
      toast.error(error instanceof Error ? error.message : "Failed to disconnect Salesforce");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch("/api/v1/integrations/salesforce/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Salesforce settings saved");
      setStatus((prev) => ({
        ...prev,
        isEnabled: data.isEnabled,
        syncDirection: data.syncDirection,
        syncIntervalMinutes: data.syncIntervalMinutes,
      }));
      setShowSettingsDialog(false);
    } catch (error) {
      console.error("Failed to save Salesforce settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const getSyncDirectionLabel = (direction: string | null) => {
    switch (direction) {
      case "import_only":
        return "Import only (Salesforce → App)";
      case "export_only":
        return "Export only (App → Salesforce)";
      case "bidirectional":
        return "Bidirectional sync";
      default:
        return "Not configured";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Salesforce
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
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
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Salesforce
                {status.connected ? (
                  status.isEnabled ? (
                    <Badge variant="default" className="ml-2">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2">
                      <XCircle className="h-3 w-3 mr-1" />
                      Disabled
                    </Badge>
                  )
                ) : (
                  <Badge variant="secondary" className="ml-2">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-2">
                Sync opportunities, accounts, and contacts with Salesforce CRM
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status.connected ? (
            <>
              {!isAdmin && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Only organization admins can connect Salesforce.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Features:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Import opportunities from Salesforce</li>
                  <li>Export opportunities to Salesforce</li>
                  <li>Sync accounts and contacts</li>
                  <li>Bidirectional sync with conflict resolution</li>
                  <li>Automatic scheduled sync</li>
                </ul>
              </div>

              <Separator />

              <div className="flex items-center gap-4">
                <Button onClick={handleConnect} disabled={!isAdmin} className="gap-2">
                  <Cloud className="h-4 w-4" />
                  Connect Salesforce
                </Button>
                <p className="text-sm text-muted-foreground">
                  You&apos;ll be redirected to Salesforce to authorize access
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {status.instanceUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Instance:</span>
                    <a
                      href={status.instanceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {status.instanceUrl.replace("https://", "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Sync direction:</span>
                  <span className="text-sm text-muted-foreground">
                    {getSyncDirectionLabel(status.syncDirection)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Sync interval:</span>
                  <span className="text-sm text-muted-foreground">
                    Every {status.syncIntervalMinutes} minutes
                  </span>
                </div>

                {status.lastSyncAt && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Last sync:</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(status.lastSyncAt).toLocaleString()}
                    </span>
                    {status.lastSyncStatus && (
                      <Badge
                        variant={status.lastSyncStatus === "success" ? "default" : "destructive"}
                      >
                        {status.lastSyncStatus}
                      </Badge>
                    )}
                  </div>
                )}

                {status.lastSyncError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{status.lastSyncError}</AlertDescription>
                  </Alert>
                )}

                {status.connectionValid === false && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Connection to Salesforce failed. Please reconnect.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="outline"
                  onClick={checkStatus}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh Status
                </Button>

                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowSettingsDialog(true)}
                      className="gap-2"
                    >
                      <Settings2 className="h-4 w-4" />
                      Settings
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() => setShowDisconnectDialog(true)}
                      disabled={disconnecting}
                      className="gap-2"
                    >
                      <Unplug className="h-4 w-4" />
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <AlertDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salesforce Sync Settings</AlertDialogTitle>
            <AlertDialogDescription>
              Configure how opportunities sync between your app and Salesforce.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="salesforce-enabled">Enable sync</Label>
              <Switch
                id="salesforce-enabled"
                checked={settingsForm.isEnabled}
                onCheckedChange={(checked) =>
                  setSettingsForm((prev) => ({ ...prev, isEnabled: checked }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync-direction">Sync direction</Label>
              <Select
                value={settingsForm.syncDirection}
                onValueChange={(value) =>
                  setSettingsForm((prev) => ({ ...prev, syncDirection: value }))
                }
              >
                <SelectTrigger id="sync-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bidirectional">Bidirectional sync</SelectItem>
                  <SelectItem value="import_only">Import only (Salesforce → App)</SelectItem>
                  <SelectItem value="export_only">Export only (App → Salesforce)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync-interval">Sync interval</Label>
              <Select
                value={settingsForm.syncIntervalMinutes.toString()}
                onValueChange={(value) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    syncIntervalMinutes: parseInt(value, 10),
                  }))
                }
              >
                <SelectTrigger id="sync-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                  <SelectItem value="120">Every 2 hours</SelectItem>
                  <SelectItem value="360">Every 6 hours</SelectItem>
                  <SelectItem value="720">Every 12 hours</SelectItem>
                  <SelectItem value="1440">Once daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingSettings}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Salesforce?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access to Salesforce and stop all syncing. Your existing data will
              remain, but Salesforce IDs will be preserved so you can reconnect later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
