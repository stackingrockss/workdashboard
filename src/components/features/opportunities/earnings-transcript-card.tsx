"use client";

import { useState } from "react";
import {
  ExternalLink,
  Copy,
  Trash2,
  ChevronDown,
  CheckCircle,
  Loader2,
  AlertCircle,
  Clock,
  Link2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/format";
import { EarningsTranscript } from "./earnings-transcripts-section";

interface EarningsTranscriptCardProps {
  transcript: EarningsTranscript;
  currentOpportunityId: string;
  onDelete: (transcriptId: string) => void;
  onLinkToOpportunity: (transcriptId: string) => void;
}

export function EarningsTranscriptCard({
  transcript,
  currentOpportunityId,
  onDelete,
  onLinkToOpportunity,
}: EarningsTranscriptCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const copyToResearch = async () => {
    if (!transcript.aiSummary) return;

    setIsCopying(true);
    try {
      const summaryText = `
${transcript.quarter} ${transcript.fiscalYear} Earnings Call Summary:

Executive Summary:
${transcript.aiSummary}

${transcript.keyQuotes && transcript.keyQuotes.length > 0 ? `
Key Quotes:
${transcript.keyQuotes.map((q) => `- ${q.speaker}: "${q.quote}"`).join("\n")}
` : ""}

${transcript.revenueGuidance && transcript.revenueGuidance.length > 0 ? `
Revenue Guidance:
${transcript.revenueGuidance.map((g) => `- ${g}`).join("\n")}
` : ""}

${transcript.productAnnouncements && transcript.productAnnouncements.length > 0 ? `
Product Announcements:
${transcript.productAnnouncements.map((p) => `- ${p}`).join("\n")}
` : ""}

${transcript.competitiveLandscape ? `
Competitive Landscape:
${transcript.competitiveLandscape}
` : ""}
      `.trim();

      const response = await fetch(`/api/v1/opportunities/${currentOpportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountResearch: summaryText }),
      });

      if (!response.ok) throw new Error("Failed to update opportunity");

      toast.success("Transcript summary copied to Account Research!");
    } catch {
      console.error("Error copying to research");
      toast.error("Failed to copy to research");
    } finally {
      setIsCopying(false);
    }
  };

  const getStatusBadge = () => {
    switch (transcript.processingStatus) {
      case "pending":
        return (
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge
            variant="outline"
            className="text-xs border-blue-500 text-blue-700 dark:text-blue-300"
          >
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing...
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-xs">
                  {transcript.processingError || "Unknown error"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
    }
  };

  const getSentimentBadge = () => {
    if (!transcript.executiveSentiment) return null;

    const config = {
      positive: {
        icon: TrendingUp,
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      },
      cautious: {
        icon: Minus,
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      },
      negative: {
        icon: TrendingDown,
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      },
    };

    const { icon: Icon, className } = config[transcript.executiveSentiment];

    return (
      <Badge className={`text-xs ${className}`}>
        <Icon className="h-3 w-3 mr-1" />
        {transcript.executiveSentiment}
      </Badge>
    );
  };

  const isLinkedToCurrentOpportunity = transcript.opportunityId === currentOpportunityId;

  return (
    <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-semibold">
                {transcript.quarter} {transcript.fiscalYear}
              </h4>
              {getStatusBadge()}
              {getSentimentBadge()}
              {isLinkedToCurrentOpportunity && (
                <Badge variant="outline" className="text-xs">
                  <Link2 className="h-3 w-3 mr-1" />
                  Linked
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDateShort(transcript.callDate)} • Source: {transcript.source}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {transcript.sourceUrl && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(transcript.sourceUrl!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View source</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {!isLinkedToCurrentOpportunity && transcript.processingStatus === "completed" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onLinkToOpportunity(transcript.id)}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Link to this opportunity</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(transcript.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete transcript</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {transcript.processingStatus === "completed" && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-2 hover:bg-muted/70 transition-all"
                        >
                          <ChevronDown
                            className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </Button>
                      </CollapsibleTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isExpanded ? "Collapse details" : "Expand details"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Collapsible>
            )}
          </div>
        </div>
      </CardHeader>

      {transcript.processingStatus === "processing" && (
        <CardContent>
          <div className="p-6 border-2 border-blue-500 bg-blue-50 dark:bg-blue-950 rounded-lg animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Processing earnings transcript...
              </h3>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              Analyzing transcript and extracting key insights. This may take 30-60
              seconds...
            </p>
            <div className="space-y-3">
              <div className="h-4 bg-blue-200 dark:bg-blue-900 rounded w-3/4"></div>
              <div className="h-4 bg-blue-200 dark:bg-blue-900 rounded w-full"></div>
              <div className="h-4 bg-blue-200 dark:bg-blue-900 rounded w-5/6"></div>
            </div>
          </div>
        </CardContent>
      )}

      {transcript.processingStatus === "completed" && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Executive Summary */}
              {transcript.aiSummary && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Executive Summary</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(transcript.aiSummary!, "Summary")
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {transcript.aiSummary}
                  </p>
                </div>
              )}

              {/* Key Quotes */}
              {transcript.keyQuotes && transcript.keyQuotes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Key Quotes</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          transcript.keyQuotes!.map((q) => `${q.speaker}: "${q.quote}"`).join("\n"),
                          "Key Quotes"
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {transcript.keyQuotes.map((quote, index) => (
                      <div
                        key={index}
                        className="p-3 bg-muted rounded-md border-l-4 border-green-500"
                      >
                        <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">
                          {quote.speaker}
                        </p>
                        <p className="text-sm text-muted-foreground italic">
                          &ldquo;{quote.quote}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revenue Guidance */}
              {transcript.revenueGuidance && transcript.revenueGuidance.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Revenue Guidance</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          transcript.revenueGuidance!.join("\n"),
                          "Revenue Guidance"
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {transcript.revenueGuidance.map((guidance, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-green-500">•</span>
                        <span>{guidance}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Product Announcements */}
              {transcript.productAnnouncements &&
                transcript.productAnnouncements.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">
                        Product Announcements
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            transcript.productAnnouncements!.join("\n"),
                            "Product Announcements"
                          )
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {transcript.productAnnouncements.map((announcement, index) => (
                        <li key={index} className="flex gap-2">
                          <span className="text-blue-500">•</span>
                          <span>{announcement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Competitive Landscape */}
              {transcript.competitiveLandscape && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">
                      Competitive Landscape
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          transcript.competitiveLandscape!,
                          "Competitive Landscape"
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {transcript.competitiveLandscape}
                  </p>
                </div>
              )}

              {/* Copy to Research Button */}
              <div className="pt-4 border-t">
                <Button
                  onClick={copyToResearch}
                  disabled={isCopying}
                  className="w-full"
                >
                  {isCopying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Copying...
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Account Research
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
