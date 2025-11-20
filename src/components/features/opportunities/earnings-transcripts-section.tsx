"use client";

/**
 * EarningsTranscriptsSection Component
 *
 * Displays earnings call transcripts for an account with AI-parsed insights.
 * - Lists transcripts with quarter, fiscal year, and processing status
 * - Auto-refreshes when transcripts are processing
 * - Expandable cards show key quotes, revenue guidance, sentiment analysis
 * - Can link transcripts to specific opportunities
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { EarningsTranscriptCard } from "./earnings-transcript-card";
import { AddEarningsTranscriptDialog } from "./add-earnings-transcript-dialog";

export interface EarningsTranscript {
  id: string;
  accountId: string;
  opportunityId: string | null;
  quarter: string;
  fiscalYear: number;
  callDate: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  transcriptText: string | null;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  processedAt: string | null;
  processingError: string | null;
  keyQuotes: Array<{ speaker: string; quote: string }> | null;
  revenueGuidance: string[] | null;
  productAnnouncements: string[] | null;
  competitiveLandscape: string | null;
  executiveSentiment: "positive" | "cautious" | "negative" | null;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
  opportunity: {
    id: string;
    name: string;
  } | null;
}

interface EarningsTranscriptsSectionProps {
  accountId: string;
  accountTicker: string | null;
  opportunityId: string;
}

export function EarningsTranscriptsSection({
  accountId,
  accountTicker,
  opportunityId,
}: EarningsTranscriptsSectionProps) {
  const [transcripts, setTranscripts] = useState<EarningsTranscript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const router = useRouter();

  // Fetch transcripts on mount
  useEffect(() => {
    fetchTranscripts();
  }, [accountId]);

  // Auto-refresh when transcripts are processing
  useEffect(() => {
    const processingTranscripts = transcripts.filter(
      (t) => t.processingStatus === "processing"
    );

    if (processingTranscripts.length === 0) return;

    const interval = setInterval(() => {
      fetchTranscripts();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [transcripts]);

  // Show toast when transcript completes
  useEffect(() => {
    const completedTranscripts = transcripts.filter(
      (t) => t.processingStatus === "completed" && t.processedAt
    );

    completedTranscripts.forEach((transcript) => {
      const toastKey = `transcript-processed-${transcript.id}`;
      const hasShownToast = sessionStorage.getItem(toastKey);

      if (!hasShownToast) {
        toast.success(
          `${transcript.quarter} ${transcript.fiscalYear} earnings call processed!`,
          {
            duration: 6000,
          }
        );
        sessionStorage.setItem(toastKey, "true");
      }
    });
  }, [transcripts]);

  const fetchTranscripts = async () => {
    try {
      const response = await fetch(
        `/api/v1/accounts/${accountId}/earnings-transcripts`
      );
      if (!response.ok) throw new Error("Failed to fetch transcripts");

      const data = await response.json();
      // Sort: linked to this opportunity first, then by date
      const sorted = (data.transcripts || []).sort((a: EarningsTranscript, b: EarningsTranscript) => {
        if (a.opportunityId === opportunityId && b.opportunityId !== opportunityId) return -1;
        if (a.opportunityId !== opportunityId && b.opportunityId === opportunityId) return 1;
        return new Date(b.callDate).getTime() - new Date(a.callDate).getTime();
      });
      setTranscripts(sorted);
    } catch (error) {
      console.error("Error fetching earnings transcripts:", error);
      toast.error("Failed to load earnings transcripts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscriptAdded = () => {
    setIsAddDialogOpen(false);
    fetchTranscripts();
    toast.success("Earnings transcript added! Processing in background...");
  };

  const handleDelete = async (transcriptId: string) => {
    try {
      const response = await fetch(`/api/v1/earnings-transcripts/${transcriptId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete transcript");

      toast.success("Transcript deleted");
      fetchTranscripts();
    } catch (error) {
      console.error("Error deleting transcript:", error);
      toast.error("Failed to delete transcript");
    }
  };

  const handleLinkToOpportunity = async (transcriptId: string) => {
    try {
      const response = await fetch(
        `/api/v1/earnings-transcripts/${transcriptId}/link-opportunity`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId }),
        }
      );

      if (!response.ok) throw new Error("Failed to link transcript");

      toast.success("Transcript linked to this opportunity");
      fetchTranscripts();
    } catch (error) {
      console.error("Error linking transcript:", error);
      toast.error("Failed to link transcript");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Earnings Call Transcripts</h3>
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
          <h3 className="text-lg font-semibold">Earnings Call Transcripts</h3>
          <p className="text-sm text-muted-foreground">
            AI-parsed insights from quarterly earnings calls
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Transcript
        </Button>
      </div>

      {transcripts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No Earnings Transcripts
            </h3>
            <p className="text-muted-foreground mb-4">
              Add earnings call transcripts to get AI-powered insights
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transcript
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transcripts.map((transcript) => (
            <EarningsTranscriptCard
              key={transcript.id}
              transcript={transcript}
              currentOpportunityId={opportunityId}
              onDelete={handleDelete}
              onLinkToOpportunity={handleLinkToOpportunity}
            />
          ))}
        </div>
      )}

      <AddEarningsTranscriptDialog
        accountId={accountId}
        accountTicker={accountTicker}
        opportunityId={opportunityId}
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleTranscriptAdded}
      />
    </div>
  );
}
