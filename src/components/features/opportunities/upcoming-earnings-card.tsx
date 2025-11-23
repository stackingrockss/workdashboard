"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Bell, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface UpcomingEarningsCardProps {
  accountId: string;
  accountName: string;
  ticker: string;
  nextEarningsDate?: Date | string | null;
  lastEarningsSync?: Date | string | null;
}

export function UpcomingEarningsCard({
  accountId,
  accountName,
  ticker,
  nextEarningsDate,
  lastEarningsSync,
}: UpcomingEarningsCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
  const [earningsDate, setEarningsDate] = useState(nextEarningsDate);
  const [lastSync, setLastSync] = useState(lastEarningsSync);

  const handleSyncEarnings = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/v1/accounts/${accountId}/sync-earnings`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync earnings");
      }

      const data = await response.json();
      setEarningsDate(data.account.nextEarningsDate);
      setLastSync(data.account.lastEarningsSync);
      toast.success("Earnings date synced successfully!");
    } catch (error) {
      console.error("Error syncing earnings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sync earnings");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateReminder = async () => {
    setIsCreatingReminder(true);
    try {
      const response = await fetch(`/api/v1/accounts/${accountId}/create-earnings-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysBeforeEarnings: 7 }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create reminder");
      }

      toast.success("Earnings reminder created in Google Tasks!");
    } catch (error) {
      console.error("Error creating reminder:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create reminder");
    } finally {
      setIsCreatingReminder(false);
    }
  };

  const earningsDateObj = earningsDate ? new Date(earningsDate) : null;
  const lastSyncObj = lastSync ? new Date(lastSync) : null;

  // Calculate days until earnings
  const daysUntilEarnings = earningsDateObj
    ? Math.ceil((earningsDateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const getStatusBadge = () => {
    if (!daysUntilEarnings) return null;

    if (daysUntilEarnings < 0) {
      return <Badge variant="secondary">Past</Badge>;
    } else if (daysUntilEarnings <= 7) {
      return <Badge variant="destructive">Upcoming</Badge>;
    } else if (daysUntilEarnings <= 14) {
      return <Badge variant="default">Soon</Badge>;
    } else {
      return <Badge variant="outline">Scheduled</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Earnings
            </CardTitle>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {earningsDateObj ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{earningsDateObj.toLocaleDateString()}</p>
                  <p className="text-sm text-muted-foreground">
                    {daysUntilEarnings !== null && daysUntilEarnings >= 0
                      ? `${daysUntilEarnings} days until earnings`
                      : "Earnings date passed"}
                  </p>
                </div>
              </div>

              {lastSyncObj && (
                <p className="text-xs text-muted-foreground">
                  Last synced: {formatDistanceToNow(lastSyncObj, { addSuffix: true })}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncEarnings}
                disabled={isSyncing}
                className="flex-1"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Date
                  </>
                )}
              </Button>

              {daysUntilEarnings !== null && daysUntilEarnings >= 1 && (
                <Button
                  size="sm"
                  onClick={handleCreateReminder}
                  disabled={isCreatingReminder}
                  className="flex-1"
                >
                  {isCreatingReminder ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Bell className="mr-2 h-4 w-4" />
                      Set Reminder
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Prepare for earnings:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Review previous quarter performance</li>
                <li>Check analyst expectations</li>
                <li>Review industry trends</li>
              </ul>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              No upcoming earnings date found for {accountName} ({ticker})
            </p>
            <Button size="sm" variant="outline" onClick={handleSyncEarnings} disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Earnings Date
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
