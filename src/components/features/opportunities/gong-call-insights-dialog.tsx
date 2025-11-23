"use client";

/**
 * GongCallInsightsDialog Component
 *
 * Displays stored parsed insights from a Gong call transcript:
 * - Pain points
 * - Goals
 * - People
 * - Next steps
 *
 * Allows user to import contacts from the parsed people list.
 */

import { useState, useEffect } from "react";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import type { RiskAssessment } from "@/types/gong-call";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContactImportReview } from "@/components/contacts/ContactImportReview";
import {
  AlertTriangle,
  Target,
  Users,
  ListChecks,
  Copy,
  Check,
  UserPlus,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface GongCallInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gongCallTitle: string;
  opportunityId: string;
  gongCallId: string; // Add gongCallId for triggering risk analysis
  insights: {
    painPoints: string[];
    goals: string[];
    people: PersonExtracted[];
    nextSteps: string[];
  };
  riskAssessment?: RiskAssessment | null;
  onContactsImported?: () => void;
  autoOpenContactImport?: boolean; // If true, opens ContactImportReview immediately
  onRiskAnalysisComplete?: () => void; // Callback when risk analysis completes
}

// ============================================================================
// Component
// ============================================================================

export function GongCallInsightsDialog({
  open,
  onOpenChange,
  gongCallTitle,
  opportunityId,
  gongCallId,
  insights,
  riskAssessment,
  onContactsImported,
  autoOpenContactImport = false,
  onRiskAnalysisComplete,
}: GongCallInsightsDialogProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [showContactImport, setShowContactImport] = useState(autoOpenContactImport);
  const [isTriggeringRiskAnalysis, setIsTriggeringRiskAnalysis] = useState(false);

  // Auto-open contact import if requested and there are contacts
  useEffect(() => {
    if (open && autoOpenContactImport && insights.people.length > 0) {
      setShowContactImport(true);
    }
  }, [open, autoOpenContactImport, insights.people.length]);

  // Debug: Log insights data when dialog opens
  console.log('GongCallInsightsDialog insights:', {
    painPointsLength: insights.painPoints?.length,
    goalsLength: insights.goals?.length,
    peopleLength: insights.people?.length,
    nextStepsLength: insights.nextSteps?.length,
    painPoints: insights.painPoints,
    goals: insights.goals,
  });

  // Copy section to clipboard
  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    toast.success(`${sectionName} copied to clipboard`);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Handle contact import completion
  const handleImportComplete = () => {
    setShowContactImport(false);
    onContactsImported?.();
  };

  // Trigger risk analysis manually
  const triggerRiskAnalysis = async () => {
    setIsTriggeringRiskAnalysis(true);
    try {
      const response = await fetch(`/api/v1/gong-calls/${gongCallId}/analyze-risk`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to trigger risk analysis");
      }

      toast.success("Risk analysis completed!");
      onRiskAnalysisComplete?.();
    } catch (error) {
      console.error("Failed to trigger risk analysis:", error);
      toast.error(error instanceof Error ? error.message : "Failed to trigger risk analysis");
    } finally {
      setIsTriggeringRiskAnalysis(false);
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

  // Render people section with table
  const renderPeopleSection = () => {
    const isEmpty = insights.people.length === 0;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              People
            </h4>
            <Badge variant="secondary">{insights.people.length}</Badge>
          </div>
          <div className="flex gap-2">
            {!isEmpty && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const text = insights.people
                      .map(
                        (p) => `${p.name} - ${p.role} at ${p.organization}`
                      )
                      .join("\n");
                    copyToClipboard(text, "People");
                  }}
                >
                  {copiedSection === "People" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowContactImport(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Import as Contacts
                </Button>
              </>
            )}
          </div>
        </div>

        {isEmpty ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            No people found in transcript
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-900 dark:text-slate-100">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-900 dark:text-slate-100">
                    Organization
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-900 dark:text-slate-100">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {insights.people.map((person, index) => (
                  <tr
                    key={index}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {person.name}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {person.organization}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {person.role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Get risk level badge color
  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    }
  };

  // Get risk severity badge color
  const getRiskSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "high":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  // Get risk category icon and label
  const getRiskCategoryInfo = (category: string) => {
    switch (category) {
      case "budget":
        return { label: "Budget", emoji: "💰" };
      case "timeline":
        return { label: "Timeline", emoji: "⏰" };
      case "competition":
        return { label: "Competition", emoji: "🏆" };
      case "technical":
        return { label: "Technical", emoji: "⚙️" };
      case "alignment":
        return { label: "Alignment", emoji: "🎯" };
      case "resistance":
        return { label: "Resistance", emoji: "🚧" };
      default:
        return { label: category, emoji: "⚠️" };
    }
  };

  // Render risk assessment section
  const renderRiskAssessmentSection = () => {
    if (!riskAssessment) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-slate-400" />
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                Risk Assessment
              </h4>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerRiskAnalysis}
              disabled={isTriggeringRiskAnalysis}
            >
              {isTriggeringRiskAnalysis ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Run Analysis
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            Risk analysis pending. Click "Run Analysis" to generate a risk assessment for this call.
          </p>
        </div>
      );
    }

    const { riskLevel, riskFactors, overallSummary, recommendedActions } = riskAssessment;

    return (
      <div className="space-y-4">
        {/* Header with overall risk level */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              Risk Assessment
            </h4>
          </div>
          <Badge className={getRiskLevelColor(riskLevel)}>
            {riskLevel.toUpperCase()}
          </Badge>
        </div>

        {/* Overall Summary */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {overallSummary}
          </p>
        </div>

        {/* Risk Factors */}
        {riskFactors.length > 0 && (
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Risk Factors ({riskFactors.length})
            </h5>
            <div className="space-y-3">
              {riskFactors.map((factor, index) => {
                const categoryInfo = getRiskCategoryInfo(factor.category);
                return (
                  <div
                    key={index}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{categoryInfo.emoji}</span>
                        <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {categoryInfo.label}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={getRiskSeverityColor(factor.severity)}
                      >
                        {factor.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {factor.description}
                    </p>
                    <div className="bg-slate-100 dark:bg-slate-700 rounded p-2">
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                        &ldquo;{factor.evidence}&rdquo;
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {recommendedActions.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recommended Actions
            </h5>
            <ul className="space-y-2">
              {recommendedActions.map((action, index) => (
                <li
                  key={index}
                  className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"
                >
                  <span className="text-blue-500 mt-1">→</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transcript Insights</DialogTitle>
          <DialogDescription>{gongCallTitle}</DialogDescription>
        </DialogHeader>

        {showContactImport ? (
          <div className="py-4">
            <ContactImportReview
              people={insights.people}
              opportunityId={opportunityId}
              onImportComplete={handleImportComplete}
              onCancel={() => setShowContactImport(false)}
            />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Risk Assessment */}
            {renderRiskAssessmentSection()}

            <Separator />

            {/* Pain Points */}
            {renderSection(
              "Pain Points",
              insights.painPoints,
              <AlertTriangle className="h-5 w-5 text-orange-600" />,
              "No pain points identified"
            )}

            <Separator />

            {/* Goals */}
            {renderSection(
              "Goals",
              insights.goals,
              <Target className="h-5 w-5 text-blue-600" />,
              "No goals identified"
            )}

            <Separator />

            {/* People */}
            {renderPeopleSection()}

            <Separator />

            {/* Next Steps */}
            {renderSection(
              "Next Steps",
              insights.nextSteps,
              <ListChecks className="h-5 w-5 text-green-600" />,
              "No next steps identified"
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
