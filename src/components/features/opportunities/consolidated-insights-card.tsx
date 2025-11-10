"use client";

/**
 * ConsolidatedInsightsCard Component
 *
 * Displays consolidated insights from multiple Gong calls:
 * - Pain points (deduplicated and synthesized)
 * - Goals (deduplicated and synthesized)
 * - Risk assessment (aggregated across all calls)
 *
 * Shows metadata about consolidation (last updated, call count)
 * Allows manual re-consolidation via button
 */

import { useState } from "react";
import type { RiskAssessment } from "@/types/gong-call";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Target,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/format";

// ============================================================================
// Types
// ============================================================================

interface ConsolidatedInsightsCardProps {
  opportunityId: string;
  consolidatedPainPoints: string[];
  consolidatedGoals: string[];
  consolidatedRiskAssessment: RiskAssessment;
  lastConsolidatedAt: string;
  consolidationCallCount: number;
  onReconsolidate?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ConsolidatedInsightsCard({
  opportunityId,
  consolidatedPainPoints,
  consolidatedGoals,
  consolidatedRiskAssessment,
  lastConsolidatedAt,
  consolidationCallCount,
  onReconsolidate,
}: ConsolidatedInsightsCardProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isReconsolidating, setIsReconsolidating] = useState(false);

  // Copy section to clipboard
  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    toast.success(`${sectionName} copied to clipboard`);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Handle manual re-consolidation
  const handleReconsolidate = async () => {
    setIsReconsolidating(true);
    try {
      const res = await fetch(
        `/api/v1/opportunities/${opportunityId}/consolidate-insights`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to trigger consolidation");
      }

      toast.success("Consolidation started! This may take a moment...");
      onReconsolidate?.();
    } catch (error) {
      console.error("Reconsolidation error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to trigger consolidation"
      );
    } finally {
      setIsReconsolidating(false);
    }
  };

  // Render section with copy button
  const renderSection = (
    title: string,
    items: string[],
    icon: React.ReactNode,
    emptyMessage: string
  ) => {
    const isEmpty = items.length === 0;
    const textContent = items.join("\n");

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h4>
            <Badge variant="secondary">{items.length}</Badge>
          </div>
          {!isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(textContent, title)}
            >
              {copiedSection === title ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {isEmpty ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            {emptyMessage}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={index}
                className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"
              >
                <span className="text-slate-400 mt-1">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // Render risk assessment section
  const renderRiskAssessment = () => {
    const riskLevelColors = {
      low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      medium:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };

    const severityColors = {
      low: "text-green-600 dark:text-green-400",
      medium: "text-yellow-600 dark:text-yellow-400",
      high: "text-orange-600 dark:text-orange-400",
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              Risk Assessment (Consolidated)
            </h4>
          </div>
          <Badge
            className={
              riskLevelColors[consolidatedRiskAssessment.riskLevel] || ""
            }
          >
            {consolidatedRiskAssessment.riskLevel.toUpperCase()}
          </Badge>
        </div>

        {/* Overall Summary */}
        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-md">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {consolidatedRiskAssessment.overallSummary}
          </p>
        </div>

        {/* Risk Factors */}
        {consolidatedRiskAssessment.riskFactors.length > 0 && (
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Risk Factors ({consolidatedRiskAssessment.riskFactors.length})
            </h5>
            <div className="space-y-2">
              {consolidatedRiskAssessment.riskFactors.map((factor, index) => (
                <div
                  key={index}
                  className="border border-slate-200 dark:border-slate-700 rounded-md p-3 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
                      {factor.category}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase ${
                        severityColors[factor.severity]
                      }`}
                    >
                      {factor.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {factor.description}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    "{factor.evidence}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {consolidatedRiskAssessment.recommendedActions.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Recommended Actions
            </h5>
            <ul className="space-y-1">
              {consolidatedRiskAssessment.recommendedActions.map(
                (action, index) => (
                  <li
                    key={index}
                    className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"
                  >
                    <span className="text-blue-500 mt-1">→</span>
                    <span>{action}</span>
                  </li>
                )
              )}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle className="text-lg">Consolidated Insights</CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Last updated: {formatDateShort(lastConsolidatedAt)} •{" "}
                {consolidationCallCount} call{consolidationCallCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReconsolidate}
            disabled={isReconsolidating}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isReconsolidating ? "animate-spin" : ""}`}
            />
            Re-consolidate
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Pain Points */}
        {renderSection(
          "Pain Points (Consolidated)",
          consolidatedPainPoints,
          <AlertTriangle className="h-5 w-5 text-red-600" />,
          "No pain points identified across calls"
        )}

        <Separator />

        {/* Goals */}
        {renderSection(
          "Goals (Consolidated)",
          consolidatedGoals,
          <Target className="h-5 w-5 text-blue-600" />,
          "No goals identified across calls"
        )}

        <Separator />

        {/* Risk Assessment */}
        {renderRiskAssessment()}
      </CardContent>
    </Card>
  );
}
