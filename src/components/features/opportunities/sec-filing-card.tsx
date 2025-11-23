"use client";

import { useState } from "react";
import {
  ExternalLink,
  Copy,
  Trash2,
  RotateCw,
  ChevronDown,
  CheckCircle,
  Loader2,
  AlertCircle,
  Clock,
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
import { SecFiling } from "./sec-filings-section";

interface SecFilingCardProps {
  filing: SecFiling;
  opportunityId: string;
  onDelete: (filingId: string) => void;
  onRetry: (filingId: string) => void;
}

export function SecFilingCard({
  filing,
  opportunityId,
  onDelete,
  onRetry,
}: SecFilingCardProps) {
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
    if (!filing.aiSummary) return;

    setIsCopying(true);
    try {
      const summaryText = `
SEC ${filing.filingType} Summary (FY ${filing.fiscalYear}):

${filing.businessOverview || ""}

Risk Factors:
${filing.riskFactors?.map((r) => `- ${r}`).join("\n") || ""}

Financial Highlights:
${filing.financialHighlights ? Object.entries(filing.financialHighlights).map(([key, value]) => `${key}: ${value}`).join("\n") : ""}

Strategic Initiatives:
${filing.strategicInitiatives || ""}
      `.trim();

      // Update opportunity's accountResearch field
      const response = await fetch(`/api/v1/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountResearch: summaryText }),
      });

      if (!response.ok) throw new Error("Failed to update opportunity");

      toast.success("Filing summary copied to Account Research field!");
    } catch {
      console.error("Error copying to research");
      toast.error("Failed to copy to research");
    } finally {
      setIsCopying(false);
    }
  };

  const getStatusBadge = () => {
    switch (filing.processingStatus) {
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
                  {filing.processingError || "Unknown error"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold">
                {filing.filingType} • FY {filing.fiscalYear}
              </h4>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-muted-foreground">
              Filed: {formatDateShort(filing.filingDate)}
              {filing.fiscalPeriod && ` • ${filing.fiscalPeriod}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(filing.filingUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View on SEC.gov</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {filing.processingStatus === "failed" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRetry(filing.id)}
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Retry processing</p>
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
                    onClick={() => onDelete(filing.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete filing</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {filing.processingStatus === "completed" && (
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

      {filing.processingStatus === "processing" && (
        <CardContent>
          <div className="p-6 border-2 border-blue-500 bg-blue-50 dark:bg-blue-950 rounded-lg animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Processing SEC filing...
              </h3>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              Fetching from SEC EDGAR and generating AI summary. This may take
              30-60 seconds...
            </p>
            <div className="space-y-3">
              <div className="h-4 bg-blue-200 dark:bg-blue-900 rounded w-3/4"></div>
              <div className="h-4 bg-blue-200 dark:bg-blue-900 rounded w-full"></div>
              <div className="h-4 bg-blue-200 dark:bg-blue-900 rounded w-5/6"></div>
            </div>
          </div>
        </CardContent>
      )}

      {filing.processingStatus === "completed" && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Business Overview */}
              {filing.businessOverview && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Business Overview</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(filing.businessOverview!, "Business Overview")
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {filing.businessOverview}
                  </p>
                </div>
              )}

              {/* Risk Factors */}
              {filing.riskFactors && filing.riskFactors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Risk Factors</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          filing.riskFactors!.map((r) => `- ${r}`).join("\n"),
                          "Risk Factors"
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {filing.riskFactors.map((risk, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-red-500">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Financial Highlights */}
              {filing.financialHighlights && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Financial Highlights</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          Object.entries(filing.financialHighlights!)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join("\n"),
                          "Financial Highlights"
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {Object.entries(filing.financialHighlights).map(
                      ([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium capitalize">{key}:</span>
                          <span>{value}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Strategic Initiatives */}
              {filing.strategicInitiatives && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">
                      Strategic Initiatives
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          filing.strategicInitiatives!,
                          "Strategic Initiatives"
                        )
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {filing.strategicInitiatives}
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
