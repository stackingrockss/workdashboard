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
  Download,
  Upload,
  ArrowLeftRight,
  Building2,
  Users,
  Target,
} from "lucide-react";
import { toast } from "sonner";

interface SyncedCounts {
  accounts: number;
  contacts: number;
  opportunities: number;
}

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
  syncedCounts?: SyncedCounts;
  createdAt?: string;
  updatedAt?: string;
}

interface SalesforceIntegrationCardProps {
  userRole: string;
}

export function SalesforceIntegrationCard({ userRole }: SalesforceIntegrationCardProps) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
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
      // Fetch both status and sync info
      const [statusRes, syncRes] = await Promise.all([
        fetch("/api/v1/integrations/salesforce/status"),
        fetch("/api/v1/integrations/salesforce/sync"),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        // Merge sync data if available
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          data.syncedCounts = syncData.syncedCounts;
          data.lastSyncAt = syncData.lastSyncAt || data.lastSyncAt;
          data.lastSyncStatus = syncData.lastSyncStatus || data.lastSyncStatus;
          data.lastSyncError = syncData.lastSyncError || data.lastSyncError;
        }
        setStatus(data);
        // Update syncing state based on status
        if (data.lastSyncStatus === "in_progress") {
          setSyncing(true);
        } else {
          setSyncing(false);
        }
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

  // Poll for sync status while syncing
  useEffect(() => {
    if (!syncing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/v1/integrations/salesforce/sync");
        if (res.ok) {
          const data = await res.json();
          if (data.lastSyncStatus !== "in_progress") {
            setSyncing(false);
            checkStatus(); // Refresh full status
            if (data.lastSyncStatus === "success") {
              toast.success("Salesforce sync completed successfully");
            } else if (data.lastSyncStatus === "failed") {
              toast.error("Salesforce sync failed", {
                description: data.lastSyncError,
              });
            }
          }
        }
      } catch (error) {
        console.error("Failed to poll sync status:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [syncing, checkStatus]);

  const handleConnect = () => {
    // Redirect to Salesforce OAuth
    window.location.href = "/api/v1/integrations/salesforce/auth";
  };

  const handleSync = async (fullSync = false, direction?: string) => {
    setSyncing(true);
    try {
      const response = await fetch("/api/v1/integrations/salesforce/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullSync, direction }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start sync");
      }

      toast.success(data.message || "Sync started");
      setStatus((prev) => ({ ...prev, lastSyncStatus: "in_progress" }));
    } catch (error) {
      console.error("Failed to trigger sync:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start sync");
      setSyncing(false);
    }
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
                        variant={
                          status.lastSyncStatus === "success"
                            ? "default"
                            : status.lastSyncStatus === "in_progress"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {status.lastSyncStatus === "in_progress" && (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        )}
                        {status.lastSyncStatus}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Synced record counts */}
                {status.syncedCounts && (
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Accounts:</span>
                      <span className="font-medium">{status.syncedCounts.accounts}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Contacts:</span>
                      <span className="font-medium">{status.syncedCounts.contacts}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Opportunities:</span>
                      <span className="font-medium">{status.syncedCounts.opportunities}</span>
                    </div>
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
                {isAdmin && (
                  <>
                    {/* Bidirectional sync button - shown for bidirectional mode */}
                    {status.syncDirection === "bidirectional" && (
                      <Button
                        onClick={() => handleSync(false)}
                        disabled={syncing || loading}
                        className="gap-2"
                      >
                        {syncing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowLeftRight className="h-4 w-4" />
                        )}
                        {syncing ? "Syncing..." : "Sync Now"}
                      </Button>
                    )}

                    {/* Import button - shown for import_only or bidirectional */}
                    {(status.syncDirection === "import_only" || status.syncDirection === "bidirectional") && (
                      <Button
                        variant={status.syncDirection === "bidirectional" ? "outline" : "default"}
                        onClick={() => handleSync(false, "import_only")}
                        disabled={syncing || loading}
                        className="gap-2"
                      >
                        {syncing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {syncing ? "Importing..." : "Import"}
                      </Button>
                    )}

                    {/* Export button - shown for export_only or bidirectional */}
                    {(status.syncDirection === "export_only" || status.syncDirection === "bidirectional") && (
                      <Button
                        variant={status.syncDirection === "bidirectional" ? "outline" : "default"}
                        onClick={() => handleSync(false, "export_only")}
                        disabled={syncing || loading}
                        className="gap-2"
                      >
                        {syncing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {syncing ? "Exporting..." : "Export"}
                      </Button>
                    )}
                  </>
                )}

                <Button
                  variant="outline"
                  onClick={checkStatus}
                  disabled={loading || syncing}
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
                      disabled={syncing}
                      className="gap-2"
                    >
                      <Settings2 className="h-4 w-4" />
                      Settings
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() => setShowDisconnectDialog(true)}
                      disabled={disconnecting || syncing}
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
