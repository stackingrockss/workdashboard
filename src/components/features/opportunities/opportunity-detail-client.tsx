"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil, Trash2, LayoutDashboard, FileText, Phone, Users, ExternalLink, AlertCircle, Target, ListChecks, Clock } from "lucide-react";
import { Opportunity, getStageLabel, OpportunityStage, getDefaultConfidenceLevel, getDefaultForecastCategory, ReviewStatus, PlatformType, getReviewStatusLabel, getPlatformTypeLabel } from "@/types/opportunity";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { updateOpportunity, deleteOpportunity, updateOpportunityField } from "@/lib/api/opportunities";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { GranolaNotesSection } from "./granola-notes-section";
import { GongCallsSection } from "./gong-calls-section";
import { GoogleNotesSection } from "./google-notes-section";
import { OrgChartSection } from "@/components/contacts/OrgChartSection";
import { Separator } from "@/components/ui/separator";
import {
  InlineTextInput,
  InlineTextarea,
  InlineTextareaWithAI,
  InlineSelect,
  InlineDatePicker,
  InlineCurrencyInput,
} from "@/components/ui/inline-editable";
import { DecisionMakerSection } from "@/components/opportunity/DecisionMakerSection";
import { Contact } from "@/types/contact";
import { RelatedEventsSection } from "@/components/calendar/related-events-section";
import { TimelineSection } from "./timeline/timeline-section";

interface OpportunityDetailClientProps {
  opportunity: Opportunity;
}

const stageOptions = [
  { value: "discovery", label: "Discovery" },
  { value: "demo", label: "Demo" },
  { value: "validateSolution", label: "Validate Solution" },
  { value: "decisionMakerApproval", label: "Decision Maker Approval" },
  { value: "contracting", label: "Contracting" },
  { value: "closedWon", label: "Closed Won" },
  { value: "closedLost", label: "Closed Lost" },
];

const forecastCategoryOptions = [
  { value: "pipeline", label: "Pipeline" },
  { value: "bestCase", label: "Best Case" },
  { value: "forecast", label: "Forecast (Commit)" },
];

const confidenceLevelOptions = [
  { value: "1", label: "1 - Very Low" },
  { value: "2", label: "2 - Low" },
  { value: "3", label: "3 - Medium" },
  { value: "4", label: "4 - High" },
  { value: "5", label: "5 - Very High" },
];

const reviewStatusOptions = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "not_applicable", label: "N/A" },
];

const platformTypeOptions = [
  { value: "oem", label: "OEM" },
  { value: "api", label: "API" },
  { value: "isv", label: "ISV" },
];

export function OpportunityDetailClient({ opportunity }: OpportunityDetailClientProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [researchStatus, setResearchStatus] = useState(opportunity.accountResearchStatus);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const router = useRouter();

  // Poll for research status when generating
  useEffect(() => {
    // Only poll if status is 'generating'
    if (researchStatus !== "generating") {
      return;
    }

    const pollResearchStatus = async () => {
      try {
        const response = await fetch(`/api/v1/opportunities/${opportunity.id}/research-status`);

        if (!response.ok) {
          console.error("Failed to poll research status");
          return;
        }

        const data = await response.json();

        // Update local status
        setResearchStatus(data.status);

        // If completed or failed, refresh the page to show updated content
        if (data.status === "completed") {
          toast.success("Account research generated!");
          router.refresh();
        } else if (data.status === "failed") {
          toast.error("Failed to generate research. You can retry manually.");
          router.refresh();
        }
      } catch (error) {
        console.error("Error polling research status:", error);
      }
    };

    // Start polling every 3 seconds
    const pollInterval = setInterval(pollResearchStatus, 3000);

    // Cleanup on unmount or when status changes
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [researchStatus, opportunity.id, router]);

  // Load contacts for decision maker section
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const response = await fetch(`/api/v1/opportunities/${opportunity.id}/contacts`);
        if (response.ok) {
          const data = await response.json();
          setContacts(data);
        }
      } catch (error) {
        console.error("Failed to load contacts:", error);
      }
    };
    loadContacts();
  }, [opportunity.id]);

  const handleUpdateOpportunity = async (data: OpportunityUpdateInput) => {
    try {
      await updateOpportunity(opportunity.id, data);
      toast.success("Opportunity updated successfully!");
      setIsEditDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update opportunity");
    }
  };

  const handleFieldUpdate = async (
    field: keyof OpportunityUpdateInput,
    value: string | number | null
  ) => {
    try {
      // When updating stage, also update confidenceLevel and forecastCategory
      if (field === "stage") {
        const stage = value as OpportunityStage;
        await updateOpportunity(opportunity.id, {
          stage,
          confidenceLevel: getDefaultConfidenceLevel(stage),
          forecastCategory: getDefaultForecastCategory(stage),
        });
      } else {
        await updateOpportunityField(opportunity.id, field, value);
      }
      toast.success("Updated successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
      throw error;
    }
  };

  const handleDeleteOpportunity = async () => {
    setIsDeleting(true);
    try {
      await deleteOpportunity(opportunity.id);
      toast.success("Opportunity deleted successfully!");
      router.push("/opportunities");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete opportunity");
      setIsDeleting(false);
    }
  };

  const handleGenerateAccountResearch = async () => {
    const accountName = opportunity.account?.name || opportunity.accountName;

    if (!accountName || accountName.trim() === "") {
      toast.error("Account name is required to generate research");
      return;
    }

    setIsGeneratingResearch(true);
    try {
      const response = await fetch("/api/v1/ai/meeting-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountName,
          stage: opportunity.stage,
          opportunityValue: opportunity.amountArr > 0 ? opportunity.amountArr : undefined,
          opportunityId: opportunity.id, // Save to database
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate account research");
      }

      // API now handles saving to database automatically
      toast.success("Account research generated successfully!");
      router.refresh();
    } catch (error) {
      console.error("Error generating research:", error);

      // Extract more detailed error message from validation errors
      let errorMessage = "Failed to generate account research";
      if (error instanceof Error) {
        errorMessage = error.message;

        // Check if it's a validation error
        if (error.message.includes("[object Object]")) {
          errorMessage = "Validation error: Generated content may be too long or contain invalid data";
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsGeneratingResearch(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/opportunities">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Opportunities
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{opportunity.name}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {opportunity.account?.name || opportunity.accountName || "No Account"}
            </p>
            {opportunity.account?.website && (
              <a
                href={opportunity.account.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                title={`Visit ${opportunity.account.name} website`}
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="research" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Research & Notes
          </TabsTrigger>
          <TabsTrigger value="meetings" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Meetings & Calls
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contacts
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Core Deal Info */}
          <div>
            <h3 className="text-sm font-medium mb-3">Core Deal Info</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InlineSelect
                label="Stage"
                value={opportunity.stage}
                onSave={async (value) => handleFieldUpdate("stage", value)}
                options={stageOptions}
                displayFormatter={(val) => getStageLabel(val as OpportunityStage)}
              />
              <InlineCurrencyInput
                label="Amount (ARR)"
                value={opportunity.amountArr}
                onSave={async (value) => handleFieldUpdate("amountArr", value)}
                displayFormatter={(val) => `${formatCurrencyCompact(val as number)} ARR`}
              />
              <InlineSelect
                label="Confidence Level"
                value={String(opportunity.confidenceLevel)}
                onSave={async (value) => handleFieldUpdate("confidenceLevel", value ? parseInt(String(value)) : null)}
                options={confidenceLevelOptions}
                displayFormatter={(val) => `${val}/5`}
              />
              <InlineDatePicker
                label="Close date"
                value={opportunity.closeDate}
                onSave={async (value) => handleFieldUpdate("closeDate", value)}
                displayFormatter={(val) => formatDateShort(val as string)}
              />
              <InlineSelect
                label="Forecast Category"
                value={opportunity.forecastCategory || ""}
                onSave={async (value) => handleFieldUpdate("forecastCategory", value || null)}
                options={forecastCategoryOptions}
                placeholder="Select category"
                displayFormatter={(val) =>
                  val ? forecastCategoryOptions.find(o => o.value === val)?.label || "" : "—"
                }
              />
              <InlineTextInput
                label="Next step"
                value={opportunity.nextStep || ""}
                onSave={async (value) => handleFieldUpdate("nextStep", value)}
                placeholder="e.g. Schedule demo call"
                className="md:col-span-2 lg:col-span-3"
              />
              <InlineTextarea
                label="Call Between Call (CBC)"
                value={opportunity.cbc || ""}
                onSave={async (value) => handleFieldUpdate("cbc", value)}
                placeholder="Action items and follow-ups before next call..."
                rows={4}
                className="md:col-span-2 lg:col-span-3"
              />
            </div>
          </div>

          <Separator />

          {/* Deal Context */}
          <div>
            <h3 className="text-sm font-medium mb-3">Deal Context</h3>
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-3">Decision Makers</h4>
              <DecisionMakerSection
                contacts={contacts}
                opportunityId={opportunity.id}
                apiEndpoint={`/api/v1/opportunities/${opportunity.id}/contacts`}
                onContactsUpdate={setContacts}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InlineTextInput
                label="Competition"
                value={opportunity.competition || ""}
                onSave={async (value) => handleFieldUpdate("competition", value)}
                placeholder="e.g. Manual process, Healthstream, Checkr..."
              />
              <InlineSelect
                label="Platform Type"
                value={opportunity.platformType || ""}
                onSave={async (value) => handleFieldUpdate("platformType", value || null)}
                options={platformTypeOptions}
                placeholder="Select platform type"
                displayFormatter={(val) => val ? getPlatformTypeLabel(val as PlatformType) : "—"}
              />
            </div>
          </div>

          <Separator />

          {/* Review Status */}
          <div>
            <h3 className="text-sm font-medium mb-3">Review Status</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InlineSelect
                label="Legal Review"
                value={opportunity.legalReviewStatus || "not_started"}
                onSave={async (value) => handleFieldUpdate("legalReviewStatus", value)}
                options={reviewStatusOptions}
                displayFormatter={(val) => getReviewStatusLabel(val as ReviewStatus)}
              />
              <InlineSelect
                label="Security Review"
                value={opportunity.securityReviewStatus || "not_started"}
                onSave={async (value) => handleFieldUpdate("securityReviewStatus", value)}
                options={reviewStatusOptions}
                displayFormatter={(val) => getReviewStatusLabel(val as ReviewStatus)}
              />
              <InlineSelect
                label="Business Case"
                value={opportunity.businessCaseStatus || "not_started"}
                onSave={async (value) => handleFieldUpdate("businessCaseStatus", value)}
                options={reviewStatusOptions}
                displayFormatter={(val) => getReviewStatusLabel(val as ReviewStatus)}
              />
            </div>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          <TimelineSection opportunityId={opportunity.id} />
        </TabsContent>

        {/* Research & Notes Tab */}
        <TabsContent value="research" className="space-y-4 mt-4">
          <div className="grid gap-4">
            {/* Account research with AI generation */}
            <InlineTextareaWithAI
              label="Account Research"
              value={opportunity.accountResearch || ""}
              onSave={async (value) => handleFieldUpdate("accountResearch", value)}
              placeholder={
                researchStatus === "generating"
                  ? "Generating account research with AI... This may take 10-30 seconds."
                  : researchStatus === "failed"
                  ? "AI generation failed. Click 'Generate with Gemini' to retry."
                  : "AI-powered account research and pre-meeting intelligence..."
              }
              rows={8}
              className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
              onGenerate={handleGenerateAccountResearch}
              isGenerating={isGeneratingResearch || researchStatus === "generating"}
              generateButtonLabel="Generate with Gemini"
            />
            <InlineTextarea
              label="Risk Notes"
              value={opportunity.riskNotes || ""}
              onSave={async (value) => handleFieldUpdate("riskNotes", value)}
              placeholder="Any concerns, blockers, or risk mitigation strategies..."
              rows={5}
              className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
            />
            <InlineTextarea
              label="Personal Notes"
              value={opportunity.notes || ""}
              onSave={async (value) => handleFieldUpdate("notes", value)}
              placeholder="Your personal notes about this opportunity..."
              rows={6}
            />

            <Separator className="my-6" />

            {/* Call Insights - Auto-generated from Gong transcripts */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Call Insights</h3>
                <span className="text-xs text-muted-foreground">
                  Auto-generated from call transcripts (sorted by meeting date, newest first)
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span>Pain Points & Challenges</span>
                </div>
                <InlineTextarea
                  label=""
                  value={opportunity.painPointsHistory || ""}
                  onSave={async (value) => handleFieldUpdate("painPointsHistory", value)}
                  placeholder="No pain points recorded yet. Add notes manually or parse Gong call transcripts."
                  rows={8}
                  className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950 font-mono text-sm whitespace-pre-wrap"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-green-500" />
                  <span>Goals & Future State</span>
                </div>
                <InlineTextarea
                  label=""
                  value={opportunity.goalsHistory || ""}
                  onSave={async (value) => handleFieldUpdate("goalsHistory", value)}
                  placeholder="No goals recorded yet. Add notes manually or parse Gong call transcripts."
                  rows={8}
                  className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 font-mono text-sm whitespace-pre-wrap"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ListChecks className="h-4 w-4 text-blue-500" />
                  <span>Next Steps</span>
                </div>
                <InlineTextarea
                  label=""
                  value={opportunity.nextStepsHistory || ""}
                  onSave={async (value) => handleFieldUpdate("nextStepsHistory", value)}
                  placeholder="No next steps recorded yet. Add notes manually or parse Gong call transcripts."
                  rows={8}
                  className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 font-mono text-sm whitespace-pre-wrap"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Meetings & Calls Tab */}
        <TabsContent value="meetings" className="space-y-6 mt-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <GranolaNotesSection
              opportunityId={opportunity.id}
              notes={opportunity.granolaNotes || []}
            />
            <GongCallsSection
              opportunityId={opportunity.id}
              calls={opportunity.gongCalls || []}
              consolidatedPainPoints={opportunity.consolidatedPainPoints as string[] | null | undefined}
              consolidatedGoals={opportunity.consolidatedGoals as string[] | null | undefined}
              consolidatedRiskAssessment={opportunity.consolidatedRiskAssessment}
              lastConsolidatedAt={opportunity.lastConsolidatedAt}
              consolidationCallCount={opportunity.consolidationCallCount}
            />
            <GoogleNotesSection
              opportunityId={opportunity.id}
              notes={opportunity.googleNotes || []}
            />
          </div>

          {/* Calendar Events Section */}
          <RelatedEventsSection
            opportunityId={opportunity.id}
            opportunityName={opportunity.name}
            accountId={opportunity.accountId}
            contactEmails={contacts.map((c) => c.email).filter((email): email is string => !!email)}
          />
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="mt-4">
          <OrgChartSection opportunityId={opportunity.id} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Opportunity</DialogTitle>
          </DialogHeader>
          <OpportunityForm
            onSubmit={handleUpdateOpportunity}
            onCancel={() => setIsEditDialogOpen(false)}
            initialData={{
              name: opportunity.name,
              account: opportunity.account?.name || opportunity.accountName,
              amountArr: opportunity.amountArr,
              confidenceLevel: opportunity.confidenceLevel,
              nextStep: opportunity.nextStep,
              cbc: opportunity.cbc,
              closeDate: opportunity.closeDate,
              stage: opportunity.stage,
              forecastCategory: opportunity.forecastCategory ?? undefined,
              riskNotes: opportunity.riskNotes,
              notes: opportunity.notes,
              accountResearch: opportunity.accountResearch,
              decisionMakers: opportunity.decisionMakers,
              competition: opportunity.competition,
              legalReviewStatus: opportunity.legalReviewStatus,
              securityReviewStatus: opportunity.securityReviewStatus,
              platformType: opportunity.platformType,
              businessCaseStatus: opportunity.businessCaseStatus,
              ownerId: opportunity.owner.id,
            }}
            submitLabel="Update Opportunity"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Opportunity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete &quot;{opportunity.name}&quot;? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteOpportunity}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
