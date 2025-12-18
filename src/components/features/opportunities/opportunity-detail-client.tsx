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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Trash2, LayoutDashboard, FileText, Users, ExternalLink, AlertCircle, Target, ListChecks, Clock, ChevronDown, Building2, FileSpreadsheet, Sparkles, Copy, HelpCircle, Briefcase } from "lucide-react";
import { Opportunity, getStageLabel, OpportunityStage, getDefaultConfidenceLevel, getDefaultForecastCategory, ReviewStatus, PlatformType, getReviewStatusLabel, getPlatformTypeLabel } from "@/types/opportunity";
import { OpportunityForm } from "@/components/forms/OpportunityForm";
import { updateOpportunity, deleteOpportunity, updateOpportunityField } from "@/lib/api/opportunities";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { GongCallsSection } from "./gong-calls-section";
import { GranolaNotesSection } from "./granola-notes-section";
import type { CalendarEvent } from "@/types/calendar";
import type { GongCall } from "@/types/gong-call";
import type { GranolaNote } from "@/types/granola-note";
import { STAGE_OPTIONS } from "@/lib/constants";
import { OrgChartSection } from "@/components/contacts/OrgChartSection";
import { Separator } from "@/components/ui/separator";
import {
  InlineTextInput,
  InlineTextarea,
  InlineSelect,
  InlineDatePicker,
  InlineCurrencyInput,
} from "@/components/ui/inline-editable";
import { InlineMarkdownWithAI } from "@/components/ui/inline-markdown";
import { DecisionMakerSection } from "@/components/opportunities/DecisionMakerSection";
import { Contact } from "@/types/contact";
import { ActivitySection } from "./activity/activity-section";
import { ConsolidatedInsightsCard } from "./consolidated-insights-card";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { SecFilingsSection } from "./sec-filings-section";
import { EarningsTranscriptsSection } from "./earnings-transcripts-section";
import { useCommentSidebar } from "@/components/comments/CommentSidebarContext";
import { useTextSelection } from "@/components/comments/useTextSelection";
import { CommentView } from "@/components/comments/CommentView";
import { CommentAnchorIcons } from "@/components/comments/CommentAnchorIcons";
import { CommentScrollbarMarkers } from "@/components/comments/CommentScrollbarMarkers";
import { SelectionCommentToolbar } from "@/components/comments/SelectionCommentToolbar";
import type { TextSelection } from "@/lib/text-selection";
import { ParseGongTranscriptDialog } from "./parse-gong-transcript-dialog";
import { GongCallInsightsDialog } from "./gong-call-insights-dialog";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import type { RiskAssessment } from "@/types/gong-call";
import { MutualActionPlanTab } from "./map";
import { BusinessProposalTab } from "./business-proposal-tab";
import { AccountIntelSummaryCard } from "./account-intel-summary-card";

interface OpportunityDetailClientProps {
  opportunity: Opportunity;
  organizationId: string;
  userId?: string;
  currentUser: {
    id: string;
    role: "ADMIN" | "MANAGER" | "REP" | "VIEWER";
    organizationId: string;
  };
  organizationUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }>;
}

// Using centralized stage options from constants
const stageOptions = STAGE_OPTIONS;

const forecastCategoryOptions = [
  { value: "pipeline", label: "Pipeline" },
  { value: "bestCase", label: "Best Case" },
  { value: "commit", label: "Commit" },
  { value: "closedWon", label: "Closed Won" },
  { value: "closedLost", label: "Closed Lost" },
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

export function OpportunityDetailClient({ opportunity, organizationId, userId, currentUser, organizationUsers }: OpportunityDetailClientProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [researchStatus, setResearchStatus] = useState(opportunity.accountResearchStatus);
  const [isGeneratingBusinessCase, setIsGeneratingBusinessCase] = useState(false);
  const [businessCaseStatus, setBusinessCaseStatus] = useState(opportunity.businessCaseGenerationStatus);
  const [businessCaseContent, setBusinessCaseContent] = useState(opportunity.businessCaseContent);
  const [businessCaseQuestions, setBusinessCaseQuestions] = useState(opportunity.businessCaseQuestions);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [allGongCalls, setAllGongCalls] = useState<GongCall[]>(Array.isArray(opportunity.gongCalls) ? opportunity.gongCalls : []);
  const [allGranolaNotes, setAllGranolaNotes] = useState<GranolaNote[]>(Array.isArray(opportunity.granolaNotes) ? opportunity.granolaNotes : []);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [addGongDialogEvent, setAddGongDialogEvent] = useState<{id: string; title: string; startTime: string | Date} | null>(null);
  const [addGranolaDialogEvent, setAddGranolaDialogEvent] = useState<{id: string; title: string; startTime: string | Date} | null>(null);
  const [selectedGongCallForParsing, setSelectedGongCallForParsing] = useState<GongCall | null>(null);
  const [selectedGongCallForViewing, setSelectedGongCallForViewing] = useState<GongCall | null>(null);
  const router = useRouter();
  const { setEntityContext, openSidebarWithSelection } = useCommentSidebar();

  // Handle comment toolbar click - opens sidebar when user clicks Comment button
  const handleCommentClick = (selection: TextSelection) => {
    openSidebarWithSelection("opportunity", opportunity.id, `/opportunities/${opportunity.id}`);
  };

  // Enable comment system (no longer auto-opens sidebar)
  useTextSelection({
    enabled: true,
    entityType: "opportunity",
    entityId: opportunity.id,
    pageContext: `/opportunities/${opportunity.id}`,
  });

  // Set entity context for comment sidebar
  useEffect(() => {
    setEntityContext("opportunity", opportunity.id, `/opportunities/${opportunity.id}`);
  }, [opportunity.id, setEntityContext]);

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

    // Start polling every 10 seconds
    const pollInterval = setInterval(pollResearchStatus, 10000); // 10s (reduced from 3s to save compute)

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
          // API returns { contacts: [...] } - extract the array, with fallback for safety
          const contactsArray = Array.isArray(data) ? data : (Array.isArray(data?.contacts) ? data.contacts : []);
          setContacts(contactsArray);
        }
      } catch (error) {
        console.error("Failed to load contacts:", error);
      }
    };
    loadContacts();
  }, [opportunity.id]);

  // Load external calendar events for this opportunity
  useEffect(() => {
    const loadCalendarEvents = async () => {
      setLoadingCalendar(true);
      try {
        // Fetch external meetings for this opportunity (90 days past to 90 days future)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 90);

        // Build query params - include accountId to also show account-matched events
        const params = new URLSearchParams({
          opportunityId: opportunity.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          externalOnly: "true",
        });
        if (opportunity.accountId) {
          params.set("accountId", opportunity.accountId);
        }

        const response = await fetch(
          `/api/v1/integrations/google/calendar/events?${params.toString()}`
        );

        if (response.ok) {
          const data = await response.json();
          setCalendarEvents(Array.isArray(data.events) ? data.events : []);
        }
      } catch (error) {
        console.error("Failed to load calendar events:", error);
      } finally {
        setLoadingCalendar(false);
      }
    };

    loadCalendarEvents();
  }, [opportunity.id, opportunity.accountId]);

  // Sync local state when opportunity prop updates (after router.refresh())
  useEffect(() => {
    setAllGongCalls(Array.isArray(opportunity.gongCalls) ? opportunity.gongCalls : []);
    setAllGranolaNotes(Array.isArray(opportunity.granolaNotes) ? opportunity.granolaNotes : []);
  }, [opportunity.gongCalls, opportunity.granolaNotes]);

  // Function to refresh all data after changes
  const handleRefreshMeetingsData = () => {
    router.refresh();
  };

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

  const handleGenerateBusinessCase = async () => {
    setIsGeneratingBusinessCase(true);
    setBusinessCaseStatus("generating");
    try {
      const response = await fetch("/api/v1/ai/business-case", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opportunityId: opportunity.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate business case");
      }

      // Update local state with the generated content
      setBusinessCaseContent(data.businessCase);
      setBusinessCaseQuestions(data.questions || null);
      setBusinessCaseStatus("completed");
      toast.success("Business case generated successfully!");
    } catch (error) {
      console.error("Error generating business case:", error);
      setBusinessCaseStatus("failed");
      toast.error(error instanceof Error ? error.message : "Failed to generate business case");
    } finally {
      setIsGeneratingBusinessCase(false);
    }
  };

  const handleCopyBusinessCase = () => {
    if (businessCaseContent) {
      navigator.clipboard.writeText(businessCaseContent);
      toast.success("Business case copied to clipboard!");
    }
  };

  // Callbacks for adding Gong/Granola calls from calendar events
  const handleAddGongCall = (event: CalendarEvent) => {
    setAddGongDialogEvent({
      id: event.id,
      title: event.summary,
      startTime: event.startTime,
    });
  };

  const handleAddGranolaNote = (event: CalendarEvent) => {
    setAddGranolaDialogEvent({
      id: event.id,
      title: event.summary,
      startTime: event.startTime,
    });
  };

  // Handlers for Gong call insights and parsing from MeetingEventCard
  const handleViewGongCallInsights = (call: GongCall) => {
    setSelectedGongCallForViewing(call);
  };

  const handleParseGongCall = (call: GongCall) => {
    setSelectedGongCallForParsing(call);
  };

  // Wrapper for viewing insights from Activity timeline (accepts ID, looks up full call)
  const handleViewGongCallInsightsById = (callId: string) => {
    const call = allGongCalls.find((c) => c.id === callId);
    if (call) {
      setSelectedGongCallForViewing(call);
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
        <TabsList className="flex w-full overflow-x-auto gap-1 scrollbar-none md:grid md:grid-cols-7">
          <TabsTrigger value="overview" className="flex items-center gap-2 shrink-0">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="research" className="flex items-center gap-2 shrink-0">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Notes</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2 shrink-0">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="account-intel" className="flex items-center gap-2 shrink-0">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Account Intel</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2 shrink-0">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="map" className="flex items-center gap-2 shrink-0">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">MAP</span>
          </TabsTrigger>
          <TabsTrigger value="proposal" className="flex items-center gap-2 shrink-0">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Proposal</span>
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
              <InlineDatePicker
                label="CBC Date"
                value={opportunity.cbc || ""}
                onSave={async (value) => handleFieldUpdate("cbc", value)}
                placeholder="Select next call date"
              />
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Next Call Date</label>
                <div className="flex items-center gap-2">
                  {opportunity.nextCallDate ? (
                    <>
                      <span className="text-sm">
                        {new Date(opportunity.nextCallDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      {opportunity.nextCallDateSource && (
                        <Badge variant={opportunity.nextCallDateSource === 'manual' ? 'secondary' : 'default'} className="text-xs">
                          {opportunity.nextCallDateSource === 'auto_calendar' && 'Auto from Calendar'}
                          {opportunity.nextCallDateSource === 'auto_gong' && 'Auto from Gong'}
                          {opportunity.nextCallDateSource === 'auto_granola' && 'Auto from Granola'}
                          {opportunity.nextCallDateSource === 'manual' && 'Manual'}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">No upcoming calls</span>
                  )}
                </div>
              </div>
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

        {/* Notes Tab */}
        <TabsContent value="research" className="space-y-4 mt-4">
          <div className="grid gap-4">
            {/* Consolidated Insights (shown when 2+ calls parsed) */}
            {opportunity.consolidatedPainPoints &&
             opportunity.consolidatedGoals &&
             opportunity.consolidatedRiskAssessment &&
             opportunity.lastConsolidatedAt &&
             opportunity.consolidationCallCount && (
              <div className="mb-6">
                <ConsolidatedInsightsCard
                  opportunityId={opportunity.id}
                  consolidatedPainPoints={opportunity.consolidatedPainPoints}
                  consolidatedGoals={opportunity.consolidatedGoals}
                  consolidatedRiskAssessment={opportunity.consolidatedRiskAssessment}
                  consolidatedWhyAndWhyNow={opportunity.consolidatedWhyAndWhyNow ?? undefined}
                  consolidatedMetrics={opportunity.consolidatedMetrics ?? undefined}
                  lastConsolidatedAt={opportunity.lastConsolidatedAt}
                  consolidationCallCount={opportunity.consolidationCallCount}
                  onReconsolidate={() => router.refresh()}
                />
              </div>
            )}

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

        {/* Activity Tab - Horizontal Timeline */}
        <TabsContent value="activity" className="mt-4">
          <ActivitySection
            opportunityId={opportunity.id}
            onViewInsights={handleViewGongCallInsightsById}
          />
        </TabsContent>

        {/* Account Intel Tab */}
        <TabsContent value="account-intel" className="mt-4 space-y-6">
          {opportunity.account ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{opportunity.account.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Account research, SEC filings, and earnings call transcripts
                  </p>
                </div>
                {opportunity.account.ticker && (
                  <div className="text-sm text-muted-foreground">
                    Ticker: <span className="font-mono font-semibold">{opportunity.account.ticker}</span>
                  </div>
                )}
              </div>

              {/* Summary Card */}
              <AccountIntelSummaryCard
                hasAccountResearch={!!opportunity.accountResearch}
                hasBusinessCase={!!businessCaseContent}
                hasSecFilings={false}
                hasEarningsTranscripts={false}
                onScrollToSection={(sectionId) => {
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />

              {/* Two-Column Grid Layout */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left Column: AI-Generated Content */}
                <div className="space-y-4">
                  {/* Account Research */}
                  <Collapsible defaultOpen={true}>
                    <Card id="account-research" className="border-l-4 border-l-blue-500">
                      <CollapsibleTrigger className="w-full group">
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                          <CardTitle className="flex items-center justify-between text-base">
                            <span className="font-semibold">Account Research</span>
                            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <InlineMarkdownWithAI
                            label=""
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
                            onGenerate={handleGenerateAccountResearch}
                            isGenerating={isGeneratingResearch || researchStatus === "generating"}
                            generateButtonLabel="Generate with Gemini"
                          />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* Business Case */}
                  <Collapsible defaultOpen={true}>
                    <Card id="business-case" className="border-l-4 border-l-blue-500">
                      <CollapsibleTrigger className="w-full group">
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                          <CardTitle className="flex items-center justify-between text-base">
                            <span className="font-semibold">Business Case</span>
                            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-4">
                          {/* Generate & Copy buttons */}
                          <div className="flex justify-between items-center">
                            <Button
                              onClick={handleGenerateBusinessCase}
                              disabled={isGeneratingBusinessCase || businessCaseStatus === "generating"}
                              variant="default"
                              size="sm"
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              {isGeneratingBusinessCase || businessCaseStatus === "generating"
                                ? "Generating..."
                                : "Generate Business Case"}
                            </Button>
                            {businessCaseContent && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyBusinessCase}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                              </Button>
                            )}
                          </div>

                          {/* Business Case Content */}
                          <InlineMarkdownWithAI
                            label="Business Case Draft"
                            value={businessCaseContent || ""}
                            onSave={async (value) => {
                              await handleFieldUpdate("businessCaseContent", value);
                              setBusinessCaseContent(value);
                            }}
                            placeholder={
                              businessCaseStatus === "generating"
                                ? "Generating business case with AI... This may take 20-60 seconds."
                                : businessCaseStatus === "failed"
                                ? "AI generation failed. Click 'Generate Business Case' to retry."
                                : "Click 'Generate Business Case' to create an AI-powered draft based on prior business cases and opportunity context."
                            }
                            rows={12}
                          />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* Discovery Questions - Separate Card */}
                  {businessCaseQuestions && (
                    <Collapsible defaultOpen={false}>
                      <Card className="border-l-4 border-l-blue-500">
                        <CollapsibleTrigger className="w-full group">
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                            <CardTitle className="flex items-center justify-between text-base">
                              <div className="flex items-center gap-2">
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold">Discovery Questions</span>
                              </div>
                              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </CardTitle>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <p className="text-sm text-muted-foreground mb-3">
                              Questions to ask the customer to gather ROI data and quantify pain points.
                            </p>
                            <InlineMarkdownWithAI
                              label=""
                              value={businessCaseQuestions}
                              onSave={async (value) => {
                                await handleFieldUpdate("businessCaseQuestions", value);
                                setBusinessCaseQuestions(value);
                              }}
                              placeholder="Questions will appear here after generation..."
                              rows={8}
                            />
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  )}
                </div>

                {/* Right Column: External Data Sources */}
                <div className="space-y-4">
                  {opportunity.account.ticker ? (
                    <>
                      <div id="sec-filings">
                        <SecFilingsSection
                          accountId={opportunity.account.id}
                          accountTicker={opportunity.account.ticker}
                          opportunityId={opportunity.id}
                        />
                      </div>

                      <div id="earnings-transcripts">
                        <EarningsTranscriptsSection
                          accountId={opportunity.account.id}
                          accountName={opportunity.account.name}
                          accountTicker={opportunity.account.ticker}
                          nextEarningsDate={opportunity.account.nextEarningsDate}
                          lastEarningsSync={opportunity.account.lastEarningsSync}
                          opportunityId={opportunity.id}
                        />
                      </div>
                    </>
                  ) : (
                    <Card className="border-l-4 border-l-slate-400 dark:border-l-slate-600">
                      <CardContent className="text-center py-8">
                        <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="font-medium mb-1">Private Company</h3>
                        <p className="text-sm text-muted-foreground">
                          SEC filings and earnings transcripts are only available for public companies.
                          Select a public company from the search when creating an opportunity to enable these features.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Account Linked</h3>
                <p className="text-muted-foreground mb-4">
                  Link an account to this opportunity to view SEC filings and earnings call transcripts.
                </p>
                <Button onClick={() => setIsEditDialogOpen(true)}>
                  Link Account
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="mt-4">
          <OrgChartSection opportunityId={opportunity.id} />
        </TabsContent>

        {/* Mutual Action Plan Tab */}
        <TabsContent value="map" className="mt-4">
          <MutualActionPlanTab opportunityId={opportunity.id} />
        </TabsContent>

        {/* Business Impact Proposal Tab */}
        <TabsContent value="proposal" className="mt-4">
          <BusinessProposalTab
            opportunityId={opportunity.id}
            businessProposalContent={opportunity.businessProposalContent}
            businessProposalGeneratedAt={opportunity.businessProposalGeneratedAt}
            businessProposalGenerationStatus={opportunity.businessProposalGenerationStatus}
            onFieldUpdate={handleFieldUpdate}
          />
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
              accountTicker: opportunity.account?.ticker,
              accountWebsite: opportunity.account?.website,
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

      {/* Comment System - Inline popovers on desktop, bottom sheet on mobile */}
      <CommentView
        entityType="opportunity"
        entityId={opportunity.id}
        organizationId={organizationId}
        pageContext={`/opportunities/${opportunity.id}`}
        currentUser={currentUser}
        organizationUsers={organizationUsers}
        mode="inline"
      />

      {/* Comment Position Indicators */}
      <CommentAnchorIcons
        entityType="opportunity"
        entityId={opportunity.id}
        organizationId={organizationId}
        pageContext={`/opportunities/${opportunity.id}`}
        userId={userId}
      />
      <CommentScrollbarMarkers
        entityType="opportunity"
        entityId={opportunity.id}
        organizationId={organizationId}
        pageContext={`/opportunities/${opportunity.id}`}
        userId={userId}
      />

      {/* Selection Comment Toolbar - appears when text is selected */}
      <SelectionCommentToolbar
        enabled={true}
        onCommentClick={handleCommentClick}
      />

      {/* AI Chat Widget */}
      <ChatWidget
        entityType="opportunity"
        entityId={opportunity.id}
        entityName={opportunity.name}
      />

      {/* Add Gong Call Dialog (triggered from calendar events) */}
      {addGongDialogEvent && (
        <Dialog open={!!addGongDialogEvent} onOpenChange={(open) => !open && setAddGongDialogEvent(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Gong Call</DialogTitle>
            </DialogHeader>
            <GongCallsSection
              opportunityId={opportunity.id}
              calls={[]}
              preselectedCalendarEvent={addGongDialogEvent}
              onCallAdded={() => {
                setAddGongDialogEvent(null);
                handleRefreshMeetingsData();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Granola Note Dialog (triggered from calendar events) */}
      {addGranolaDialogEvent && (
        <Dialog open={!!addGranolaDialogEvent} onOpenChange={(open) => !open && setAddGranolaDialogEvent(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Granola Note</DialogTitle>
            </DialogHeader>
            <GranolaNotesSection
              opportunityId={opportunity.id}
              notes={[]}
              preselectedCalendarEvent={addGranolaDialogEvent}
              onNoteAdded={() => {
                setAddGranolaDialogEvent(null);
                handleRefreshMeetingsData();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Parse Gong Transcript Dialog (triggered from MeetingEventCard) */}
      {selectedGongCallForParsing && (
        <ParseGongTranscriptDialog
          open={!!selectedGongCallForParsing}
          onOpenChange={(open) => {
            if (!open) setSelectedGongCallForParsing(null);
          }}
          opportunityId={opportunity.id}
          gongCallId={selectedGongCallForParsing.id}
          onContactsImported={() => {
            router.refresh();
          }}
          onParsingStarted={() => {
            router.refresh();
            handleRefreshMeetingsData();
          }}
        />
      )}

      {/* Gong Call Insights Dialog (triggered from MeetingEventCard) */}
      {selectedGongCallForViewing && selectedGongCallForViewing.parsedAt && (
        <GongCallInsightsDialog
          open={!!selectedGongCallForViewing}
          onOpenChange={(open) => {
            if (!open) setSelectedGongCallForViewing(null);
          }}
          gongCallTitle={selectedGongCallForViewing.title}
          opportunityId={opportunity.id}
          gongCallId={selectedGongCallForViewing.id}
          insights={{
            painPoints: (selectedGongCallForViewing.painPoints as string[]) || [],
            goals: (selectedGongCallForViewing.goals as string[]) || [],
            people: (selectedGongCallForViewing.parsedPeople as PersonExtracted[]) || [],
            nextSteps: (selectedGongCallForViewing.nextSteps as string[]) || [],
          }}
          riskAssessment={(selectedGongCallForViewing.riskAssessment as RiskAssessment) || null}
          onContactsImported={() => {
            router.refresh();
          }}
          onRiskAnalysisComplete={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
