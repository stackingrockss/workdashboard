"use client";

/**
 * SecFilingsSection Component
 *
 * Displays SEC filings for an account with AI-generated summaries.
 * - Lists filings with status badges (pending, processing, completed, failed)
 * - Auto-refreshes when filings are processing
 * - Expandable cards show business overview, risk factors, financials
 * - Copy-to-clipboard functionality for sales teams
 *
 * Background processing:
 * - Triggers Inngest job to fetch from SEC EDGAR
 * - Gemini AI generates structured summary
 * - Polls every 3s for status updates
 */

import { useState, useEffect, useCallback } from "react";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { SecFilingCard } from "./sec-filing-card";
import { AddSecFilingDialog } from "./add-sec-filing-dialog";

export interface SecFiling {
  id: string;
  accountId: string;
  filingType: string;
  filingDate: string;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  accessionNumber: string;
  filingUrl: string;
  cik: string;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  processedAt: string | null;
  processingError: string | null;
  businessOverview: string | null;
  riskFactors: string[] | null;
  financialHighlights: Record<string, string> | null;
  strategicInitiatives: string | null;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SecFilingsSectionProps {
  accountId: string;
  accountTicker: string | null;
  opportunityId: string;
}

export function SecFilingsSection({
  accountId,
  accountTicker,
  opportunityId,
}: SecFilingsSectionProps) {
  const [filings, setFilings] = useState<SecFiling[]>([]);
  // Defensive check - ensure filings is always an array
  const safeFilings = Array.isArray(filings) ? filings : [];
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const fetchFilings = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/accounts/${accountId}/sec-filings`);
      if (!response.ok) throw new Error("Failed to fetch filings");

      const data = await response.json();
      setFilings(data.filings || []);
    } catch (error) {
      console.error("Error fetching SEC filings:", error);
      toast.error("Failed to load SEC filings");
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  // Fetch filings on mount
  useEffect(() => {
    fetchFilings();
  }, [fetchFilings]);

  // Auto-refresh when filings are processing
  useEffect(() => {
    const processingFilings = safeFilings.filter(
      (f) => f.processingStatus === "processing"
    );

    if (processingFilings.length === 0) return;

    const interval = setInterval(() => {
      fetchFilings(); // Re-fetch to get updated status
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [filings, fetchFilings]);

  // Show toast when filing completes
  useEffect(() => {
    const completedFilings = safeFilings.filter(
      (f) => f.processingStatus === "completed" && f.processedAt
    );

    completedFilings.forEach((filing) => {
      const toastKey = `filing-processed-${filing.id}`;
      const hasShownToast = sessionStorage.getItem(toastKey);

      if (!hasShownToast) {
        toast.success(
          `${filing.filingType} FY${filing.fiscalYear} processed successfully!`,
          {
            duration: 6000,
          }
        );
        sessionStorage.setItem(toastKey, "true");
      }
    });
  }, [filings]);

  const handleFilingAdded = () => {
    setIsAddDialogOpen(false);
    fetchFilings();
    toast.success("SEC filing added! Processing in background...");
  };

  const handleDelete = async (filingId: string) => {
    try {
      const response = await fetch(`/api/v1/sec-filings/${filingId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete filing");

      toast.success("Filing deleted");
      fetchFilings();
    } catch (error) {
      console.error("Error deleting filing:", error);
      toast.error("Failed to delete filing");
    }
  };

  const handleRetry = async (filingId: string) => {
    try {
      const response = await fetch(`/api/v1/sec-filings/${filingId}/retry`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to retry filing");

      toast.success("Retrying filing processing...");
      fetchFilings();
    } catch (error) {
      console.error("Error retrying filing:", error);
      toast.error("Failed to retry filing");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">SEC Filings</h3>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SEC Filings</h3>
          <p className="text-sm text-muted-foreground">
            AI-powered summaries of 10-K, 10-Q, and 8-K filings
          </p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          size="sm"
          disabled={!accountTicker}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Filing
        </Button>
      </div>

      {!accountTicker && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Add a stock ticker symbol to the account to fetch SEC filings automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {safeFilings.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No SEC Filings</h3>
            <p className="text-muted-foreground mb-4">
              Add SEC filings to get AI-powered insights on this company
            </p>
            {accountTicker && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Filing
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {safeFilings.map((filing) => (
            <SecFilingCard
              key={filing.id}
              filing={filing}
              opportunityId={opportunityId}
              onDelete={handleDelete}
              onRetry={handleRetry}
            />
          ))}
        </div>
      )}

      <AddSecFilingDialog
        accountId={accountId}
        accountTicker={accountTicker}
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleFilingAdded}
      />
    </div>
  );
}
