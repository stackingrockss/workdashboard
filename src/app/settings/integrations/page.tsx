"use client";

import { useState, useEffect, Suspense } from "react";
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
import { Calendar, CheckCircle, XCircle, Loader2, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { CalendarConnectionStatus } from "@/types/calendar";

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<CalendarConnectionStatus>({
    connected: false,
  });

  // Check for OAuth callback status
  useEffect(() => {
    const status = searchParams.get("status");
    const error = searchParams.get("error");

    if (status === "connected") {
      toast.success("Google Calendar connected successfully!");
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

  // Load connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);

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

      toast.success("Google Calendar disconnected successfully");
      setConnectionStatus({ connected: false });
      setShowDisconnectDialog(false);
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error(error instanceof Error ? error.message : "Failed to disconnect calendar");
    } finally {
      setDisconnecting(false);
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
    <div className="py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-8 w-8" />
          Integrations
        </h1>
        <p className="text-muted-foreground mt-2">
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

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={checkConnectionStatus}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh Status
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
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access to your Google Calendar and remove all stored credentials.
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

export default function IntegrationsSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  );
}
