"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Calendar, CheckCircle, XCircle, Loader2, RefreshCw, Unplug, AlertCircle, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { CalendarConnectionStatus } from "@/types/calendar";
import Link from "next/link";

export function IntegrationsSettingsContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showDomainWarning, setShowDomainWarning] = useState(false);
  const [orgDomain, setOrgDomain] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<CalendarConnectionStatus>({
    connected: false,
  });

  // Check for OAuth callback status
  useEffect(() => {
    const status = searchParams.get("status");
    const error = searchParams.get("error");

    if (status === "connected") {
      toast.success("Google services connected successfully!");
      // Reload connection status
      checkConnectionStatus();
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_failed: "OAuth authentication failed. Please try again.",
        invalid_callback: "Invalid OAuth callback. Please try again.",
        config_error: "Google OAuth is not properly configured.",
        no_token: "Failed to receive access token from Google.",
        callback_failed: "OAuth callback failed. Please try again.",
      };
      toast.error(errorMessages[error] || "Failed to connect Google Calendar");
    }
  }, [searchParams]);

  // Load connection status and org domain on mount
  useEffect(() => {
    checkConnectionStatus();
    checkOrganizationDomain();
  }, []);

  const checkOrganizationDomain = async () => {
    try {
      const response = await fetch('/api/v1/organization');
      if (response.ok) {
        const data = await response.json();
        setOrgDomain(data.organization?.domain || null);
      }
    } catch (error) {
      console.error('Failed to check organization domain:', error);
    }
  };

  const checkConnectionStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/integrations/google/status");

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data);
      } else {
        setConnectionStatus({ connected: false });
      }
    } catch (error) {
      console.error("Failed to check connection status:", error);
      setConnectionStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    // Check if organization domain is set before connecting
    if (!orgDomain) {
      setShowDomainWarning(true);
      return;
    }

    // Redirect to OAuth authorization endpoint
    window.location.href = "/api/v1/integrations/google/authorize";
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/v1/integrations/google/disconnect", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect");
      }

      toast.success("Google services disconnected successfully");
      setConnectionStatus({ connected: false });
      setShowDisconnectDialog(false);
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error(error instanceof Error ? error.message : "Failed to disconnect calendar");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/v1/integrations/google/calendar/sync", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync calendar");
      }

      toast.success(data.message || "Calendar synced successfully", {
        description: `${data.stats.eventsProcessed} events processed, ${data.stats.eventsCreated} created, ${data.stats.eventsUpdated} updated`,
      });

      // Refresh connection status to show new lastSync time
      await checkConnectionStatus();
    } catch (error) {
      console.error("Failed to sync calendar:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sync calendar");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Integrations</h2>
        <p className="text-muted-foreground mt-1">
          Connect external services to enhance your workflow
        </p>
      </div>

      {/* Google Calendar Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Google Calendar
                {connectionStatus.connected ? (
                  <Badge variant="default" className="ml-2">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-2">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-2">
                Connect your Google Calendar to view and manage meetings alongside opportunities
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connectionStatus.connected ? (
            <>
              {!orgDomain && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Organization domain not configured.</strong> Please set your organization domain first to enable external meeting detection.{' '}
                    <Link href="/settings/organization" className="text-primary hover:underline font-medium">
                      Go to Organization Settings
                    </Link>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Features:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>View external meetings alongside opportunities</li>
                  <li>Track meeting frequency with each account</li>
                  <li>Create follow-up meetings directly from opportunities</li>
                  <li>Automatically link meetings to deals</li>
                  <li>Schedule action items on your calendar</li>
                </ul>
              </div>

              <Separator />

              <div className="flex items-center gap-4">
                <Button onClick={handleConnect} className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Connect Google Calendar
                </Button>
                <p className="text-sm text-muted-foreground">
                  You&apos;ll be redirected to Google to grant permissions
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {connectionStatus.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Connected as:</span>
                    <span className="text-sm text-muted-foreground">
                      {connectionStatus.email}
                    </span>
                  </div>
                )}

                {connectionStatus.lastSync && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Last synced:</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(connectionStatus.lastSync).toLocaleString()}
                    </span>
                  </div>
                )}

                {connectionStatus.scopes && connectionStatus.scopes.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Permissions:</span>
                    <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                      {connectionStatus.scopes.map((scope) => (
                        <li key={scope}>
                          {scope.includes("calendar.events")
                            ? "• Read and write calendar events"
                            : scope.includes("calendar.readonly")
                            ? "• Read calendar events"
                            : scope.includes("userinfo.email")
                            ? "• Access email address"
                            : `• ${scope}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="default"
                  onClick={handleSyncNow}
                  disabled={syncing || loading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>

                <Button
                  variant="outline"
                  onClick={checkConnectionStatus}
                  disabled={loading || syncing}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh Status
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
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Google Tasks Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Google Tasks
                {connectionStatus.connected && connectionStatus.scopes?.includes('https://www.googleapis.com/auth/tasks') ? (
                  <Badge variant="default" className="ml-2">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="ml-2">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-2">
                Connect your Google Tasks to view and manage tasks alongside opportunities
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connectionStatus.connected || !connectionStatus.scopes?.includes('https://www.googleapis.com/auth/tasks') ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Features:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>View upcoming tasks on your dashboard</li>
                  <li>Link tasks to opportunities and accounts</li>
                  <li>Track overdue and today&apos;s tasks</li>
                  <li>Create and manage tasks from the app</li>
                  <li>Auto-sync every 15 minutes</li>
                </ul>
              </div>

              <Separator />

              <div className="flex items-center gap-4">
                <Button onClick={handleConnect} className="gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Connect Google Tasks
                </Button>
                <p className="text-sm text-muted-foreground">
                  You&apos;ll be redirected to Google to grant permissions
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {connectionStatus.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Connected as:</span>
                    <span className="text-sm text-muted-foreground">
                      {connectionStatus.email}
                    </span>
                  </div>
                )}

                {connectionStatus.lastSync && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Last synced:</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(connectionStatus.lastSync).toLocaleString()}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-sm font-medium">Permissions:</span>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    <li>• Read and write tasks</li>
                    <li>• Manage task lists</li>
                  </ul>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="outline"
                  onClick={checkConnectionStatus}
                  disabled={loading || syncing}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh Status
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

                <p className="text-sm text-muted-foreground">
                  Tasks sync automatically every 15 minutes
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Domain Warning Dialog */}
      <AlertDialog open={showDomainWarning} onOpenChange={setShowDomainWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Organization Domain Required</AlertDialogTitle>
            <AlertDialogDescription>
              To enable external meeting detection, you must configure your organization domain first.
              External meetings are detected by comparing attendee email domains with your organization domain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Without Domain</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link href="/settings/organization">
                Configure Domain
              </Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Services?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access to your Google Calendar and Google Tasks, and remove all stored credentials.
              You can reconnect at any time.
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
    </div>
  );
}
